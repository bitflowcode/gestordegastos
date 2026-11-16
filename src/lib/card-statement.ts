// ============================================================
// card-statement.ts
// Parser del CSV de extracto de tarjeta -> movimientos normalizados.
// Naming genérico (sin marca). Preparado para varios proveedores.
// Sin dependencias externas.
//
// Cerrado tras diez rondas de revisión. Lo que no se debe "simplificar" al
// leerlo, porque cada punto costó una corrección:
//
//   * parseAmount resuelve el separador decimal por REGLA ESTRUCTURAL y recurre
//     al formato declarado del proveedor solo en el caso genuinamente ambiguo
//     (un separador seguido de exactamente tres dígitos). Adivinar por valor
//     multiplicaba por cien todos los importes de un extracto europeo, en
//     silencio y con la suite en verde.
//   * decimalSep es un parámetro OBLIGATORIO: con valor por defecto, una llamada
//     que lo omitiera devolvería un número erróneo sin ningún aviso.
//   * la base del id sintético usa toFixed(4), no toFixed(2): la divisa original
//     puede tener tres decimales (KWD, BHD, TND, OMR), la misma razón por la que
//     original_amount es DECIMAL(14,4) en el esquema.
//   * las columnas de tipo son obligatorias: sin ellas no se distingue una
//     compra de tarjeta de una transferencia, y el parser devolvería cero
//     movimientos sin ningún error.
//   * los números de línea son los REALES del archivo, para que los
//     diagnósticos apunten al sitio correcto aunque haya líneas en blanco o
//     saltos dentro de campos entrecomillados.
// ============================================================

// ---------- tipos ----------
export interface CardMovement {
  externalId: string          // id del proveedor, o 'SYN-...' sintético
  syntheticId: boolean        // true si el id se generó por no venir en el CSV
  date: string                // YYYY-MM-DD
  amount: number              // importe positivo, en la divisa original
  currency: string            // ISO 4217 en mayúsculas
  description: string
  merchant: string
  cardLast4: string           // 4 dígitos con cero inicial, o '' si venía vacía
  isCardDebit: boolean        // compra de tarjeta (CARD + DEBIT)
  isCredit: boolean           // reembolso/abono de tarjeta (CARD + CREDIT)
}

export interface ExcludedRow {
  line: number                // nº de línea REAL en el archivo (1 = cabecera)
  reason: 'fecha_invalida' | 'importe_invalido'
  raw: string[]
}

export interface ParseResult {
  provider: string
  movements: CardMovement[]    // compras válidas, deduplicadas intra-lote
  credits: CardMovement[]      // abonos CARD+CREDIT ignorados (se informan)
  excluded: ExcludedRow[]      // filas descartadas con motivo y línea real
  nonCardCount: number         // filas no-CARD (transferencias, conversiones...)
  unknownCardTypeCount: number // filas CARD con tipo no reconocido
  duplicatesInFile: number     // filas colapsadas por dedup intra-lote
  syntheticIdCount: number     // movimientos con id generado
  cards: string[]              // tarjetas (last4) presentes en las compras
  missingLast4: number         // compras cuya celda de tarjeta venía vacía
  currencies: Record<string, number>
  dateMin: string | null       // rango del extracto -> consulta de dedup
  dateMax: string | null
}

export class CardStatementError extends Error {}

// ---------- proveedores: mapa de columnas por formato ----------
// Añadir otro banco = añadir otra entrada aquí; nada más cambia.
interface ProviderMap {
  name: string
  columns: {
    id: string
    date: string
    amount: string
    currency: string
    description: string
    merchant: string
    last4: string
    txType: string
    detailsType: string
  }
  cardValue: string
  debitValue: string
  creditValue: string
  // Separador decimal declarado del formato. Solo se consulta en el caso
  // genuinamente ambiguo (un separador seguido de exactamente 3 dígitos):
  // el resto se resuelve por regla estructural. Ver parseAmount.
  decimalSep: '.' | ','
}

const PROVIDERS: ProviderMap[] = [
  {
    name: 'wise', // etiqueta interna; NO se muestra al usuario
    columns: {
      id: 'TransferWise ID',
      date: 'Date',
      amount: 'Amount',
      currency: 'Currency',
      description: 'Description',
      merchant: 'Merchant',
      last4: 'Card Last Four Digits',
      txType: 'Transaction Type',
      detailsType: 'Transaction Details Type',
    },
    cardValue: 'CARD',
    debitValue: 'DEBIT',
    creditValue: 'CREDIT',
    decimalSep: '.',
  },
]

// Columnas obligatorias, por clave. 'merchant' y 'description' son opcionales.
// txType y detailsType SON obligatorias: sin ellas no se puede distinguir una
// compra de tarjeta de una transferencia, y el parser devolvería cero
// movimientos sin ningún error.
const REQUIRED_KEYS = [
  'id', 'date', 'amount', 'currency', 'last4', 'txType', 'detailsType',
] as const

// Etiquetas genéricas para los mensajes de error: evitan filtrar el nombre
// del proveedor (p. ej. "TransferWise ID") a la interfaz de usuario.
const REQUIRED_LABELS: Record<(typeof REQUIRED_KEYS)[number], string> = {
  id: 'identificador del movimiento',
  date: 'fecha',
  amount: 'importe',
  currency: 'divisa',
  last4: 'últimos 4 dígitos de la tarjeta',
  txType: 'tipo de movimiento',
  detailsType: 'tipo de detalle del movimiento',
}

// ---------- codificación: bytes -> texto ----------
export function decodeStatementBytes(
  bytes: ArrayBuffer | Uint8Array,
  forced?: 'utf-8' | 'latin1'
): { text: string; encoding: 'utf-8' | 'latin1' } {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (forced) {
    return { text: new TextDecoder(forced).decode(buf), encoding: forced }
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return { text, encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('latin1').decode(buf), encoding: 'latin1' }
  }
}

// ---------- detección de separador de campos ----------
export function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t']
  let best = ',', bestCount = -1
  for (const d of candidates) {
    let count = 0, inQ = false
    for (let i = 0; i < headerLine.length; i++) {
      const c = headerLine[i]
      if (c === '"') inQ = !inQ
      else if (c === d && !inQ) count++
    }
    if (count > bestCount) { bestCount = count; best = d }
  }
  return best
}

// ---------- helpers de normalización ----------
export function pad4(v: unknown): string {
  const digits = String(v ?? '').replace(/\D/g, '')
  return digits ? digits.padStart(4, '0') : ''
}

// YYYY-MM-DD, aceptando DD-MM-YYYY o YYYY-MM-DD (sep - o /). null si inválida.
// La fecha del proveedor se toma literalmente: nunca se enruta por Date ni
// por toISOString(), que desplazarían el día según la zona horaria.
export function normalizeDate(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim().slice(0, 10)
  let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

// ---------- importes ----------
//
// Importe -> número. null si no se puede parsear (nunca 0 silencioso).
//
// El separador decimal NO se adivina por el valor. Se resuelve en tres
// niveles, del más fuerte al más débil:
//
//   1. AMBOS separadores presentes: el decimal es el que aparece más a la
//      derecha. Verdad universal, no depende del proveedor.
//
//   2. UN separador, y la estructura descarta una de las lecturas. Un
//      separador de MILES va siempre seguido de exactamente 3 dígitos, y un
//      número solo puede llevar UN separador decimal. Por tanto:
//        '11,60'      -> 2 dígitos: imposible como miles  -> decimal
//        '1.234.567'  -> 2 separadores: imposible como decimal -> miles
//        '1.23.456'   -> ni una cosa ni la otra -> null (no es un número)
//      Este nivel es el que evita el fallo x100: con la versión anterior,
//      '11,60' en un export de separador ';' (coma decimal) se leía como
//      1160 si el proveedor declaraba punto decimal.
//
//   3. UN separador seguido de exactamente 3 dígitos ('12.500'): es el
//      ÚNICO caso genuinamente ambiguo, porque puede ser 12500 o 12,5.
//      Aquí, y solo aquí, decide el separador declarado del proveedor.
//      Es lo que permite leer bien las divisas de 3 decimales (KWD, BHD,
//      TND, OMR) sin romper los separadores de miles.
//
// decimalSep es OBLIGATORIO a propósito: con valor por defecto, cualquier
// llamada que lo omitiera devolvería un número erróneo sin ningún aviso.
export function parseAmount(raw: unknown, decimalSep: '.' | ','): number | null {
  if (raw == null) return null
  let s = String(raw).trim().replace(/["\s]/g, '')
  if (s === '') return null

  // Signo: admite minus final ('40,00-'), usado por parte de la banca europea.
  let negative = false
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1) }
  if (s.startsWith('-')) { negative = true; s = s.slice(1) }
  else if (s.startsWith('+')) { s = s.slice(1) }

  const nComma = (s.match(/,/g) || []).length
  const nDot = (s.match(/\./g) || []).length

  if (nComma > 0 && nDot > 0) {
    // Nivel 1: el de más a la derecha es el decimal.
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    // El decimal solo puede aparecer una vez.
    if ((decimal === ',' ? nComma : nDot) !== 1) return null
    const [intPart, decPart] = s.split(decimal)
    const groups = intPart.split(thousands)
    // Todo grupo tras el primero debe ser de exactamente 3 dígitos.
    if (!groups.slice(1).every((g) => /^\d{3}$/.test(g))) return null
    s = groups.join('') + '.' + decPart
  } else if (nComma > 0 || nDot > 0) {
    const sep = nComma > 0 ? ',' : '.'
    const count = nComma > 0 ? nComma : nDot
    const groups = s.split(sep)
    const canBeThousands = groups.slice(1).every((g) => /^\d{3}$/.test(g))
    const canBeDecimal = count === 1

    if (canBeThousands && canBeDecimal) {
      // Nivel 3: ambiguo de verdad -> decide el formato del proveedor.
      s = sep === decimalSep ? groups.join('.') : groups.join('')
    } else if (canBeThousands) {
      s = groups.join('')          // Nivel 2: solo puede ser miles
    } else if (canBeDecimal) {
      s = groups.join('.')         // Nivel 2: solo puede ser decimal
    } else {
      return null                  // Nivel 2: no es un número válido
    }
  }

  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

// ---------- id sintético ----------
// Solo se usa cuando el CSV no trae identificador. Dos hashes concatenados
// (~64 bits) para que la colisión entre movimientos distintos sea
// despreciable, y un discriminador de repetición para que dos compras
// genuinamente idénticas el mismo día NO colapsen una sobre otra.
function synthId(basis: string, occurrence: number): string {
  const key = occurrence > 1 ? `${basis}#${occurrence}` : basis
  let djb2 = 5381, sdbm = 0
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i)
    djb2 = ((djb2 << 5) + djb2 + ch) >>> 0
    sdbm = (ch + (sdbm << 6) + (sdbm << 16) - sdbm) >>> 0
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0')
  return `SYN-${hex(djb2)}${hex(sdbm)}`
}

// ---------- parser CSV robusto ----------
// Devuelve el nº de línea REAL de cada fila, para que los diagnósticos
// apunten al sitio correcto del archivo aunque haya líneas en blanco o
// saltos de línea dentro de campos entrecomillados.
export interface CsvRow { line: number; cells: string[] }

export function parseCSV(text: string, delimiter: string): CsvRow[] {
  text = text.replace(/^\uFEFF/, '')
  const rows: CsvRow[] = []
  let cells: string[] = [], field = '', inQuotes = false
  let line = 1, rowStart = 1

  const flushRow = () => {
    cells.push(field); field = ''
    if (cells.some((c) => c !== '')) rows.push({ line: rowStart, cells })
    cells = []
  }

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        if (c === '\n') line++
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === delimiter) { cells.push(field); field = '' }
      else if (c === '\r') { /* ignora */ }
      else if (c === '\n') { flushRow(); line++; rowStart = line }
      else field += c
    }
  }
  if (field !== '' || cells.length) flushRow()
  return rows
}

// ---------- selección de proveedor por cabeceras ----------
function pickProvider(headers: string[]): ProviderMap {
  const set = new Set(headers.map((h) => h.trim()))
  let bestMissing: string[] | null = null

  for (const p of PROVIDERS) {
    const missing = REQUIRED_KEYS.filter((k) => !set.has(p.columns[k]))
    if (missing.length === 0) return p
    if (bestMissing === null || missing.length < bestMissing.length) {
      bestMissing = missing.map((k) => REQUIRED_LABELS[k])
    }
  }

  throw new CardStatementError(
    'El archivo no coincide con ningún formato de extracto conocido. ' +
    `Faltan estas columnas obligatorias: ${bestMissing!.join(', ')}.`
  )
}

// ---------- parseo principal ----------
export function parseCardStatement(csvText: string): ParseResult {
  const firstLine = csvText.replace(/^\uFEFF/, '').split('\n')[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const rows = parseCSV(csvText, delimiter)
  if (rows.length < 2) throw new CardStatementError('El CSV no contiene datos.')

  const headers = rows[0].cells.map((h) => h.trim())
  const provider = pickProvider(headers)
  const idx = (name: string) => headers.indexOf(name)
  const c = {
    id: idx(provider.columns.id),
    date: idx(provider.columns.date),
    amount: idx(provider.columns.amount),
    currency: idx(provider.columns.currency),
    description: idx(provider.columns.description),
    merchant: idx(provider.columns.merchant),
    last4: idx(provider.columns.last4),
    txType: idx(provider.columns.txType),
    detailsType: idx(provider.columns.detailsType),
  }

  const movements: CardMovement[] = []
  const credits: CardMovement[] = []
  const excluded: ExcludedRow[] = []
  let nonCardCount = 0
  let unknownCardTypeCount = 0
  let missingLast4 = 0
  const synthCounts = new Map<string, number>()

  for (let r = 1; r < rows.length; r++) {
    const { line, cells: row } = rows[r]
    const detailsType = (row[c.detailsType] || '').trim().toUpperCase()
    const txType = (row[c.txType] || '').trim().toUpperCase()

    if (detailsType !== provider.cardValue) { nonCardCount++; continue }

    const date = normalizeDate(row[c.date])
    if (date === null) { excluded.push({ line, reason: 'fecha_invalida', raw: row }); continue }

    const amt = parseAmount(row[c.amount], provider.decimalSep)
    if (amt === null) { excluded.push({ line, reason: 'importe_invalido', raw: row }); continue }

    const merchant = (row[c.merchant] || '').trim()
    const last4 = pad4(row[c.last4])
    if (!last4) missingLast4++
    const amount = Math.abs(amt)

    let externalId = (row[c.id] || '').trim()
    const syntheticId = externalId === ''
    if (syntheticId) {
      // toFixed(4), no (2): la divisa original puede tener 3 decimales.
      const basis = `${date}|${amount.toFixed(4)}|${merchant}|${last4}`
      const occurrence = (synthCounts.get(basis) ?? 0) + 1
      synthCounts.set(basis, occurrence)
      externalId = synthId(basis, occurrence)
    }

    const mov: CardMovement = {
      externalId,
      syntheticId,
      date,
      amount,
      currency: (row[c.currency] || '').trim().toUpperCase(),
      description: (row[c.description] || '').trim(),
      merchant,
      cardLast4: last4,
      isCardDebit: txType === provider.debitValue,
      isCredit: txType === provider.creditValue,
    }

    if (mov.isCardDebit) movements.push(mov)
    else if (mov.isCredit) credits.push(mov)
    // Movimiento de tarjeta con un tipo que no reconocemos. Contador propio:
    // sumarlo a nonCardCount lo haría desaparecer como si fuera una
    // transferencia, y es la única señal si el proveedor añade un tipo nuevo.
    else unknownCardTypeCount++
  }

  // Deduplicación intra-lote por externalId (conserva el primero).
  const seen = new Set<string>()
  const deduped: CardMovement[] = []
  for (const m of movements) {
    if (seen.has(m.externalId)) continue
    seen.add(m.externalId)
    deduped.push(m)
  }
  const duplicatesInFile = movements.length - deduped.length

  // Array.from y no spread de Set: el proyecto compila con target es5.
  const cards = Array.from(new Set(deduped.map((m) => m.cardLast4).filter(Boolean)))
  const currencies: Record<string, number> = {}
  let dateMin: string | null = null, dateMax: string | null = null
  let syntheticIdCount = 0
  for (const m of deduped) {
    currencies[m.currency] = (currencies[m.currency] || 0) + 1
    if (m.syntheticId) syntheticIdCount++
    if (dateMin === null || m.date < dateMin) dateMin = m.date
    if (dateMax === null || m.date > dateMax) dateMax = m.date
  }

  return {
    provider: provider.name,
    movements: deduped,
    credits,
    excluded,
    nonCardCount,
    unknownCardTypeCount,
    duplicatesInFile,
    syntheticIdCount,
    cards,
    missingLast4,
    currencies,
    dateMin,
    dateMax,
  }
}

// ---------- utilidades para el hook ----------
// Filtra compras de una tarjeta concreta, por igualdad estricta.
// Un last4 vacío devuelve lista vacía en lugar de los movimientos sin
// tarjeta, para que una llamada accidental no los impute a un presupuesto.
export function filterByCard(movs: CardMovement[], last4: string): CardMovement[] {
  const want = pad4(last4)
  if (!want) return []
  return movs.filter((m) => m.cardLast4 === want)
}

// Movimientos sin tarjeta asignada: no pueden imputarse a ningún presupuesto.
// La previsualización debe advertirlo de forma destacada.
export function movementsWithoutCard(movs: CardMovement[]): CardMovement[] {
  return movs.filter((m) => !m.cardLast4)
}
