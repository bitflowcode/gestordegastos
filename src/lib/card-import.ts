// ============================================================
// card-import.ts
// Lógica del importador de extractos: qué es nuevo, qué ya está, qué se parece
// sospechosamente a un gasto anotado a mano, y cómo se escribe todo ello.
//
// Los movimientos importados NO viven en una tabla aparte: son filas normales de
// `user_expenses` con marcas. Por eso suman solos a los totales y a las
// categorías, sin código de reconciliación.
// ============================================================

import type { CardMovement } from './card-statement'
import { DEFAULT_TARGET_CURRENCY } from './currency'
import { sugerirCategoria } from './merchant-category'

/** Gasto ya presente en la base, tal como lo necesita el importador. */
export interface GastoExistente {
  id: string
  date: string
  amount: number
  category: string
  note: string
  source: string
  externalId: string | null
}

export interface TasaAplicada {
  rate: number
  rateDate: string
}

/** Un movimiento del extracto, ya clasificado para la previsualización. */
export interface MovimientoAnalizado {
  movimiento: CardMovement
  /** Categoría sugerida, editable en la previsualización. */
  categoria: string | null
  /** Tasa usada para convertir a la divisa base. null si hay que teclearla. */
  tasa: TasaAplicada | null
  /** Importe en la divisa base, o null si falta la tasa. */
  importeBase: number | null
  /**
   * Gastos que se le parecen lo bastante como para preguntar. Nunca se descarta
   * nada por esto: solo se sugiere. Un duplicado real que se cuela se ve y se
   * borra; un movimiento eliminado por su cuenta no se echa de menos.
   */
  posiblesDuplicados: GastoExistente[]
}

export interface AnalisisExtracto {
  nuevos: MovimientoAnalizado[]
  /** Ya importados antes: mismo external_id, y siguen contando en los totales. */
  yaImportados: CardMovement[]
  /**
   * Importados y descartados por el usuario en una importación anterior. No se
   * vuelven a ofrecer —para eso se conserva su external_id— pero se cuentan
   * aparte: mezclarlos con los anteriores diría "3 ya importados" cuando uno de
   * ellos el usuario decidió que no lo era.
   */
  descartadosAntes: CardMovement[]
  /** Divisas del extracto distintas de la de destino. */
  divisasExtranjeras: string[]
  /** Movimientos sin tasa de cambio: la importación necesita que se teclee. */
  sinTasa: number
}

/** Margen de la detección difusa. Acordado en el diseño: ±0,01 € y ±3 días. */
export const MARGEN_IMPORTE = 0.01
export const MARGEN_DIAS = 3

/** Tamaño de bloque de inserción. */
export const TAMANO_BLOQUE = 500

/**
 * Distancia en días entre dos fechas 'YYYY-MM-DD'.
 *
 * En UTC puro y solo para comparar: las fechas de gasto nunca se enrutan por
 * Date para construirlas o mostrarlas, porque el desfase de zona horaria
 * desplazaría el día.
 */
export function distanciaEnDias(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.abs(Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000
}

/** Redondeo a la escala de `amount` en la base de datos. */
export function redondearImporte(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Gastos que podrían ser el mismo movimiento ya anotado a mano.
 *
 * Solo mira gastos que NO vienen de un extracto: comparar contra otros
 * importados sería redundante, porque de eso ya se encarga el external_id, y
 * llenaría la previsualización de ruido.
 */
export function buscarPosiblesDuplicados(
  movimiento: CardMovement,
  importeBase: number | null,
  existentes: GastoExistente[]
): GastoExistente[] {
  if (importeBase === null) return []
  return existentes.filter(
    g =>
      g.source !== 'card_import' &&
      g.source !== 'card_import_excluded' &&
      Math.abs(g.amount - importeBase) <= MARGEN_IMPORTE &&
      distanciaEnDias(g.date, movimiento.date) <= MARGEN_DIAS
  )
}

/**
 * Clasifica el extracto contra lo que ya hay en la base.
 *
 * `existentes` debe venir de una consulta acotada al RANGO DE FECHAS del
 * extracto y SIN filtrar por `source`. Sin los `card_import_excluded`, un
 * movimiento que el usuario descartó volvería a ofrecerse en cada
 * reimportación, que es justo lo que su external_id evita.
 */
export function analizarExtracto(
  movimientos: CardMovement[],
  existentes: GastoExistente[],
  categoriasUsuario: string[],
  tasas: Record<string, Record<string, TasaAplicada>>,
  divisaDestino: string = DEFAULT_TARGET_CURRENCY
): AnalisisExtracto {
  const origenPorId = new Map<string, string>()
  for (const g of existentes) {
    if (g.externalId) origenPorId.set(g.externalId, g.source)
  }

  const nuevos: MovimientoAnalizado[] = []
  const yaImportados: CardMovement[] = []
  const descartadosAntes: CardMovement[] = []
  const divisas = new Set<string>()
  let sinTasa = 0

  for (const m of movimientos) {
    const origen = origenPorId.get(m.externalId)
    if (origen !== undefined) {
      if (origen === 'card_import_excluded') descartadosAntes.push(m)
      else yaImportados.push(m)
      continue
    }

    const esDivisaBase = m.currency === divisaDestino
    if (!esDivisaBase) divisas.add(m.currency)

    const tasa = esDivisaBase
      ? { rate: 1, rateDate: m.date }
      : tasas[m.currency]?.[m.date] ?? null

    const importeBase = tasa === null ? null : redondearImporte(m.amount * tasa.rate)
    if (tasa === null) sinTasa++

    nuevos.push({
      movimiento: m,
      categoria: sugerirCategoria(`${m.merchant} ${m.description}`, categoriasUsuario),
      tasa,
      importeBase,
      posiblesDuplicados: buscarPosiblesDuplicados(m, importeBase, existentes),
    })
  }

  return {
    nuevos,
    yaImportados,
    descartadosAntes,
    divisasExtranjeras: Array.from(divisas),
    sinTasa,
  }
}

/** Fila de `user_expenses` lista para insertar. */
export interface FilaImportacion {
  id: string
  user_id: string
  amount: number
  category: string
  date: string
  note: string
  is_recurring: boolean
  source: 'card_import' | 'card_import_excluded'
  external_id: string
  card_last4: string | null
  merchant: string | null
  currency: string
  original_amount: number
  exchange_rate: number
}

/**
 * Construye la fila a insertar.
 *
 * Los movimientos que el usuario decide NO importar se escriben igualmente, con
 * `source = 'card_import_excluded'`: conservan su external_id, y eso es lo que
 * impide que vuelvan a ofrecerse cada vez que se reimporte el extracto del mes
 * en curso. Al quedar fuera del mapeo de carga, no cuentan en totales ni en
 * presupuesto.
 */
export function construirFila(
  analizado: MovimientoAnalizado,
  userId: string,
  nuevoId: () => string,
  incluir: boolean,
  divisaDestino: string = DEFAULT_TARGET_CURRENCY
): FilaImportacion {
  const m = analizado.movimiento
  if (analizado.importeBase === null || analizado.tasa === null) {
    throw new Error(`El movimiento ${m.externalId} no tiene tipo de cambio`)
  }

  return {
    id: nuevoId(),
    user_id: userId,
    amount: analizado.importeBase,
    category: analizado.categoria ?? 'Otros',
    date: m.date,
    // Comercio primero: la descripción de Wise es una frase entera que repite
    // el importe («Transacción con tarjeta de 7,30 EUR emitida por…») y en el
    // Historial enterraba lo único útil. El detalle de divisa original que esa
    // frase lleva se puede consultar en el extracto; la nota es para leerse.
    note: m.merchant || m.description || 'Movimiento de tarjeta',
    is_recurring: false,
    source: incluir ? 'card_import' : 'card_import_excluded',
    external_id: m.externalId,
    card_last4: m.cardLast4 || null,
    merchant: m.merchant || null,
    // Se persiste siempre, también cuando la divisa es la de destino: así el
    // importe en euros es reproducible sin tener que saber qué se supuso.
    currency: m.currency,
    original_amount: m.amount,
    exchange_rate: analizado.tasa.rate,
  }
}

/** Trocea en bloques de inserción. */
export function partirEnBloques<T>(items: T[], tamano: number = TAMANO_BLOQUE): T[][] {
  const bloques: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    bloques.push(items.slice(i, i + tamano))
  }
  return bloques
}

/** Rango de fechas del extracto, para acotar la consulta de deduplicación. */
export function rangoDeFechas(movimientos: CardMovement[]): { desde: string; hasta: string } | null {
  if (movimientos.length === 0) return null
  let desde = movimientos[0].date
  let hasta = movimientos[0].date
  for (const m of movimientos) {
    if (m.date < desde) desde = m.date
    if (m.date > hasta) hasta = m.date
  }
  return { desde, hasta }
}

/**
 * Cliente mínimo que necesita la inserción. Se declara así, y no con el tipo del
 * cliente de Supabase, para poder ejercitar el troceado y la red de integridad
 * con un doble en las pruebas: son dos caminos que de otro modo solo se
 * recorrerían en producción, con datos reales.
 */
export interface ClienteInsercion {
  from(tabla: string): {
    upsert(
      filas: FilaImportacion[],
      opciones: { onConflict: string; ignoreDuplicates: boolean }
    ): {
      select(columnas: string): Promise<{
        data: Array<{ id: string }> | null
        error: { message: string } | null
      }>
    }
  }
}

export interface ResultadoInsercion {
  solicitadas: number
  insertadas: number
  /**
   * Filas que la red de integridad omitió por existir ya. Si esto no es cero,
   * la deduplicación previa falló un caso: la previsualización dijo "12 nuevos"
   * y entraron 11. Se cuenta para poder decirlo, no para corregirlo solo.
   */
  omitidasPorConflicto: number
  error: string | null
}

/**
 * Inserta en bloques.
 *
 * `ignoreDuplicates: true` SIEMPRE. El índice único es pleno, así que
 * técnicamente admite `DO UPDATE`, pero eso sobrescribiría las filas existentes
 * y revertiría las recategorizaciones que el usuario haya hecho a mano desde el
 * Historial. La barrera aquí es documental, no mecánica: no cambiar esta línea.
 */
export async function insertarFilas(
  cliente: ClienteInsercion,
  filas: FilaImportacion[]
): Promise<ResultadoInsercion> {
  let insertadas = 0

  for (const bloque of partirEnBloques(filas)) {
    const { data, error } = await cliente
      .from('user_expenses')
      .upsert(bloque, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      // Se devuelve lo que sí entró: con bloques de 500, un fallo a mitad no
      // puede presentarse como si no se hubiera importado nada.
      return {
        solicitadas: filas.length,
        insertadas,
        omitidasPorConflicto: 0,
        error: error.message,
      }
    }

    insertadas += (data || []).length
  }

  return {
    solicitadas: filas.length,
    insertadas,
    omitidasPorConflicto: filas.length - insertadas,
    error: null,
  }
}
