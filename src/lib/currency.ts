// ============================================================
// currency.ts
// Divisa de destino y utilidades puras del subsistema de tipos de cambio.
//
// El euro NO se escribe dentro del route handler ni del importador: se resuelve
// desde aquí. Cuando la divisa base pase a ser configurable por el usuario
// —trabajo aparte, fuera del módulo de tarjetas—, el cambio será sustituir esta
// constante por la preferencia, sin tocar la importación.
// ============================================================

export const DEFAULT_TARGET_CURRENCY = 'EUR'

/** Primer día con tipos de referencia publicados por el BCE. */
export const ECB_FIRST_DAY = '1999-01-04'

/** Tope de fechas por petición. Un extracto mensual no llega a 31 días hábiles. */
export const MAX_DATES_PER_REQUEST = 62

export type RateUnavailableReason =
  | 'sin_cobertura'   // el BCE no publica esa divisa (p. ej. KWD)
  | 'sin_dato'        // no hay tasa para esa fecha (anterior a 1999 o aún sin publicar)
  | 'no_disponible'   // el proveedor no respondió

export interface ResolvedRate {
  rate: number
  /**
   * Fecha de la tasa realmente aplicada. Puede ser anterior a la pedida: los
   * fines de semana y festivos no tienen publicación y se resuelven al día
   * hábil previo. Se propaga hasta la interfaz para que el usuario vea qué se
   * le aplicó y no tenga que suponerlo.
   */
  rateDate: string
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  // Descarta 2026-02-31 y similares sin enrutar por Date, que además aceptaría
  // el desbordamiento convirtiéndolo al 3 de marzo en silencio.
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1) return false
  const bisiesto = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return d <= dias[m - 1]
}

/**
 * Tasa aplicable a una fecha dentro de una serie de tipos por día.
 *
 * La serie del BCE solo trae días hábiles, así que se toma la última fecha
 * publicada que no sea posterior a la pedida. Devuelve null en vez de una tasa
 * aproximada cuando no hay ninguna anterior: sin dato, se pide a mano.
 */
export function resolveRateForDate(
  series: Record<string, number>,
  date: string
): ResolvedRate | null {
  const disponibles = Object.keys(series).sort()
  let elegida: string | null = null
  for (const d of disponibles) {
    if (d <= date) elegida = d
    else break
  }
  return elegida === null ? null : { rate: series[elegida], rateDate: elegida }
}

/**
 * Suma (o resta) días a una fecha 'YYYY-MM-DD' en UTC puro.
 *
 * Aritmética de calendario, no de zona horaria: se construye y se lee siempre en
 * UTC, así que el resultado no depende de dónde se ejecute. No sirve para
 * fechas de gasto, que se manipulan como cadena; aquí solo se usa para ampliar
 * el rango de consulta al proveedor.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const r = new Date(t)
  const mm = String(r.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(r.getUTCDate()).padStart(2, '0')
  return `${r.getUTCFullYear()}-${mm}-${dd}`
}
