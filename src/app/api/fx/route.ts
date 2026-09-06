import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_TARGET_CURRENCY,
  ECB_FIRST_DAY,
  MAX_DATES_PER_REQUEST,
  addDays,
  isCurrencyCode,
  isIsoDate,
  resolveRateForDate,
  type RateUnavailableReason,
  type ResolvedRate,
} from '@/lib/currency'

// ============================================================
// /api/fx — tipos de cambio HISTÓRICOS, por fecha de movimiento.
//
// Por qué históricos y no del día: con la tasa del día de la importación, el
// importe en euros de un mismo movimiento cambiaría según cuándo se importe, y
// los totales de meses ya cerrados se moverían solos en cada reimportación.
//
// Por qué en el servidor y no en el navegador: las tasas pasadas son inmutables
// y se cachean, así que un extracto de 150 movimientos no dispara 150 llamadas
// al proveedor. Se piden todas las fechas del extracto de una vez y el rango se
// resuelve con UNA consulta al proveedor.
//
// Qué NO hace: fallar. Si el proveedor no responde, o la divisa no está entre
// las que publica el BCE, devuelve la tasa como no disponible con su motivo. La
// importación no puede quedarse bloqueada por esto; el usuario introduce el tipo
// a mano, que además es el mecanismo previsto de corrección (las tasas de
// referencia del BCE no incluyen el diferencial del emisor).
//
// El euro no está escrito aquí: la divisa de destino es un parámetro que hoy se
// resuelve desde `DEFAULT_TARGET_CURRENCY`.
// ============================================================

const PROVIDER = 'https://api.frankfurter.dev/v1'
const PROVIDER_TIMEOUT_MS = 8000

/**
 * Días que se amplía hacia atrás el rango pedido al proveedor. La serie del BCE
 * solo trae días hábiles: sin margen, un movimiento del lunes de Pascua o del 1
 * de enero se quedaría sin ninguna fecha anterior a la que caer. Diez días
 * cubren cualquier puente y cualquier cierre de fin de año.
 */
const MARGEN_DIAS_HABILES = 10

/** Tasas ya resueltas. Las de fechas pasadas no cambian nunca. */
const cacheTasas = new Map<string, ResolvedRate>()
const MAX_CACHE = 5000

/** Divisas que publica el BCE. Se refresca a diario; cambia muy de tarde en tarde. */
let cacheDivisas: { lista: Set<string>; expira: number } | null = null
const TTL_DIVISAS_MS = 24 * 60 * 60 * 1000

function claveCache(from: string, to: string, date: string): string {
  return `${from}>${to}|${date}`
}

function guardarEnCache(clave: string, valor: ResolvedRate) {
  // Sin política de expulsión, un proceso de larga vida crecería sin límite.
  if (cacheTasas.size >= MAX_CACHE) cacheTasas.clear()
  cacheTasas.set(clave, valor)
}

/**
 * Respuesta del proveedor, distinguiendo "no tiene el dato" de "no responde".
 *
 * La diferencia no es cosmética: con 'sin_dato' no hay tasa y no la habrá, así
 * que reintentar es inútil y toca teclearla; con 'no_disponible' el dato existe
 * y basta con volver a intentarlo más tarde. Colapsar ambos casos en uno le
 * daría al usuario el consejo equivocado la mitad de las veces.
 */
type RespuestaProveedor =
  | { estado: 'ok'; datos: unknown }
  | { estado: 'sin_dato' }
  | { estado: 'no_disponible' }

async function pedirAlProveedor(ruta: string): Promise<RespuestaProveedor> {
  try {
    const res = await fetch(`${PROVIDER}${ruta}`, {
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    // El 404 es como el proveedor dice "no tengo ese dato": divisa fuera de la
    // cobertura del BCE, o fecha todavía sin publicar.
    if (res.status === 404) return { estado: 'sin_dato' }
    if (!res.ok) return { estado: 'no_disponible' }
    return { estado: 'ok', datos: await res.json() }
  } catch {
    // Red caída, tiempo agotado o JSON ilegible.
    return { estado: 'no_disponible' }
  }
}

/** Divisas cubiertas, o null si el proveedor no responde. */
async function divisasCubiertas(): Promise<Set<string> | null> {
  if (cacheDivisas && cacheDivisas.expira > Date.now()) return cacheDivisas.lista

  const res = await pedirAlProveedor('/currencies')
  if (res.estado !== 'ok' || !res.datos || typeof res.datos !== 'object') return null

  const lista = new Set(Object.keys(res.datos as Record<string, string>))
  cacheDivisas = { lista, expira: Date.now() + TTL_DIVISAS_MS }
  return lista
}

/** Serie de tipos día a día entre dos fechas, o el motivo por el que no la hay. */
async function serieDeTipos(
  from: string,
  to: string,
  desde: string,
  hasta: string
): Promise<Record<string, number> | RateUnavailableReason> {
  const res = await pedirAlProveedor(`/${desde}..${hasta}?base=${from}&symbols=${to}`)
  if (res.estado !== 'ok') return res.estado
  if (!res.datos || typeof res.datos !== 'object') return 'no_disponible'

  const rates = (res.datos as { rates?: Record<string, Record<string, number>> }).rates
  if (!rates) return 'no_disponible'

  const serie: Record<string, number> = {}
  for (const fecha of Object.keys(rates)) {
    const valor = rates[fecha]?.[to]
    if (typeof valor === 'number' && Number.isFinite(valor)) serie[fecha] = valor
  }
  return serie
}

function respuesta(
  from: string,
  to: string,
  rates: Record<string, ResolvedRate | null>,
  unavailable?: RateUnavailableReason
) {
  const completa = Object.keys(rates).every(d => rates[d] !== null)
  return NextResponse.json(
    unavailable ? { from, to, rates, unavailable } : { from, to, rates },
    {
      headers: {
        // Solo se cachea lo que ya no puede cambiar. Una respuesta con huecos
        // podría completarse más tarde, cuando el BCE publique o el proveedor
        // vuelva.
        'Cache-Control': completa ? 'private, max-age=86400' : 'no-store',
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const from = (params.get('from') || '').toUpperCase()
  const to = (params.get('to') || DEFAULT_TARGET_CURRENCY).toUpperCase()
  const crudas = (params.get('dates') || params.get('date') || '')
    .split(',')
    .map(d => d.trim())
    .filter(Boolean)

  if (!isCurrencyCode(from) || !isCurrencyCode(to)) {
    return NextResponse.json({ error: 'Divisa no válida' }, { status: 400 })
  }
  if (crudas.length === 0) {
    return NextResponse.json({ error: 'Falta la fecha del movimiento' }, { status: 400 })
  }
  if (crudas.length > MAX_DATES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Demasiadas fechas en una petición (máximo ${MAX_DATES_PER_REQUEST})` },
      { status: 400 }
    )
  }
  if (crudas.some(d => !isIsoDate(d))) {
    return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  }

  const fechas = Array.from(new Set(crudas)).sort()

  // Misma divisa: la conversión es la identidad. Ni se consulta ni se cachea.
  if (from === to) {
    const rates: Record<string, ResolvedRate | null> = {}
    for (const d of fechas) rates[d] = { rate: 1, rateDate: d }
    return respuesta(from, to, rates)
  }

  // Anteriores a la primera publicación del BCE: no hay dato y no lo habrá.
  const rates: Record<string, ResolvedRate | null> = {}
  const pendientes: string[] = []
  for (const d of fechas) {
    if (d < ECB_FIRST_DAY) {
      rates[d] = null
      continue
    }
    const enCache = cacheTasas.get(claveCache(from, to, d))
    if (enCache) rates[d] = enCache
    else pendientes.push(d)
  }

  // Ya está todo resuelto (o descartado por ser anterior a 1999). El motivo se
  // calcula sobre TODAS las fechas: un null sin motivo obliga a adivinar en el
  // cliente por qué no hay tasa.
  if (pendientes.length === 0) {
    return respuesta(from, to, rates, fechas.some(d => rates[d] === null) ? 'sin_dato' : undefined)
  }

  const desde = addDays(pendientes[0], -MARGEN_DIAS_HABILES)
  const hasta = pendientes[pendientes.length - 1]
  const serie = await serieDeTipos(from, to, desde < ECB_FIRST_DAY ? ECB_FIRST_DAY : desde, hasta)

  if (typeof serie === 'string') {
    for (const d of pendientes) rates[d] = null

    // La lista de divisas solo se consulta AQUÍ, para distinguir "el BCE no
    // publica esta divisa" de "aún no hay tasa para esa fecha": el proveedor
    // responde 404 a los dos casos. En el camino normal no se pide, así que una
    // conversión correcta cuesta una sola llamada, y una caída del proveedor no
    // encadena dos esperas hasta agotar el tiempo.
    if (serie === 'sin_dato') {
      const cubiertas = await divisasCubiertas()
      if (cubiertas && (!cubiertas.has(from) || !cubiertas.has(to))) {
        return respuesta(from, to, rates, 'sin_cobertura')
      }
    }
    return respuesta(from, to, rates, serie)
  }

  for (const d of pendientes) {
    const resuelta = resolveRateForDate(serie, d)
    rates[d] = resuelta
    if (resuelta) guardarEnCache(claveCache(from, to, d), resuelta)
  }

  return respuesta(from, to, rates, fechas.some(d => rates[d] === null) ? 'sin_dato' : undefined)
}
