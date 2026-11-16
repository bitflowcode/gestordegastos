// Tests de card-import.ts
// Ejecutar: npm run test:import
//
// Cubren los tres invariantes que ninguna prueba de integración detectaría si se
// rompieran: que los movimientos descartados se escriben en vez de olvidarse,
// que la detección difusa solo sugiere, y que la inserción trocea y sabe si la
// red de integridad se disparó.

import {
  analizarExtracto, buscarPosiblesDuplicados, construirFila, distanciaEnDias,
  insertarFilas, partirEnBloques, rangoDeFechas, redondearImporte,
  type FilaImportacion, type GastoExistente,
} from './card-import.ts'
import type { CardMovement } from './card-statement.ts'

let pass = 0, fail = 0
function eq(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log(`${ok ? 'OK ' : 'XX '} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (esperado ' + JSON.stringify(exp) + ')'}`)
  ok ? pass++ : fail++
}

const CATEGORIAS = ['Alimentación', 'Transporte', 'Salud', 'Otros']

function mov(p: Partial<CardMovement> & { externalId: string; date: string; amount: number }): CardMovement {
  return {
    syntheticId: false, currency: 'EUR', description: '', merchant: '',
    cardLast4: '0973', isCardDebit: true, isCredit: false, ...p,
  }
}

function gasto(p: Partial<GastoExistente> & { id: string; date: string; amount: number }): GastoExistente {
  return { category: 'Otros', note: '', source: 'manual', externalId: null, ...p }
}

console.log('--- distancia entre fechas ---')
eq('mismo día', distanciaEnDias('2026-06-14', '2026-06-14'), 0)
eq('cruza el mes', distanciaEnDias('2026-06-30', '2026-07-02'), 2)
eq('cruza el año', distanciaEnDias('2025-12-31', '2026-01-02'), 2)
eq('bisiesto', distanciaEnDias('2024-02-28', '2024-03-01'), 2)
eq('simétrica', distanciaEnDias('2026-07-02', '2026-06-30'), 2)

console.log('--- redondeo ---')
eq('dos decimales', redondearImporte(11.599999), 11.6)
eq('medio céntimo hacia arriba', redondearImporte(0.125), 0.13)
eq('el clásico 1.005', redondearImporte(1.005), 1.01)
eq('conversión típica', redondearImporte(25 * 0.86044), 21.51)

console.log('--- detección difusa: solo sugiere ---')
const existentes: GastoExistente[] = [
  gasto({ id: 'manual-igual', date: '2026-06-14', amount: 11.6 }),
  gasto({ id: 'manual-1-centimo', date: '2026-06-14', amount: 11.61 }),
  gasto({ id: 'manual-2-centimos', date: '2026-06-14', amount: 11.62 }),
  gasto({ id: 'manual-3-dias', date: '2026-06-17', amount: 11.6 }),
  gasto({ id: 'manual-4-dias', date: '2026-06-18', amount: 11.6 }),
  gasto({ id: 'ya-importado', date: '2026-06-14', amount: 11.6, source: 'card_import', externalId: 'OTRO' }),
  gasto({ id: 'descartado', date: '2026-06-14', amount: 11.6, source: 'card_import_excluded', externalId: 'OTRO-2' }),
]
const candidato = mov({ externalId: 'CARD-1', date: '2026-06-14', amount: 11.6 })
eq(
  'importe ±0,01 y fecha ±3 días, y solo gastos manuales',
  buscarPosiblesDuplicados(candidato, 11.6, existentes).map(g => g.id),
  ['manual-igual', 'manual-1-centimo', 'manual-3-dias']
)
eq('sin importe base no se compara nada', buscarPosiblesDuplicados(candidato, null, existentes), [])

console.log('--- análisis del extracto ---')
const yaEnBase: GastoExistente[] = [
  gasto({ id: 'x', date: '2026-06-10', amount: 5, source: 'card_import', externalId: 'CARD-VIEJO' }),
  // Descartado por el usuario en una importación anterior: NO debe volver a
  // ofrecerse. Es la razón de que la consulta de dedup no filtre por source.
  gasto({ id: 'y', date: '2026-06-11', amount: 7, source: 'card_import_excluded', externalId: 'CARD-DESCARTADO' }),
]
const analisis = analizarExtracto(
  [
    mov({ externalId: 'CARD-VIEJO', date: '2026-06-10', amount: 5 }),
    mov({ externalId: 'CARD-DESCARTADO', date: '2026-06-11', amount: 7 }),
    mov({ externalId: 'CARD-NUEVO', date: '2026-06-14', amount: 11.6, merchant: 'MERCADONA 4321' }),
    mov({ externalId: 'CARD-USD', date: '2026-06-15', amount: 25, currency: 'USD', merchant: 'AMZN Mktp' }),
    mov({ externalId: 'CARD-SIN-TASA', date: '2026-06-16', amount: 30, currency: 'KWD' }),
  ],
  yaEnBase,
  CATEGORIAS,
  { USD: { '2026-06-15': { rate: 0.86044, rateDate: '2026-06-12' } } }
)
eq('los ya importados no se ofrecen', analisis.yaImportados.map(m => m.externalId), ['CARD-VIEJO'])
eq('un descartado tampoco vuelve a ofrecerse', analisis.nuevos.some(n => n.movimiento.externalId === 'CARD-DESCARTADO'), false)
eq('y se cuenta aparte, no como "ya importado"', analisis.descartadosAntes.map(m => m.externalId), ['CARD-DESCARTADO'])
eq('nuevos', analisis.nuevos.map(n => n.movimiento.externalId), ['CARD-NUEVO', 'CARD-USD', 'CARD-SIN-TASA'])
eq('categoría sugerida de las del usuario', analisis.nuevos[0].categoria, 'Alimentación')
eq('divisa base: tasa 1 y mismo importe', [analisis.nuevos[0].tasa?.rate, analisis.nuevos[0].importeBase], [1, 11.6])
eq('divisa extranjera convertida', analisis.nuevos[1].importeBase, 21.51)
eq('conserva la fecha real de la tasa', analisis.nuevos[1].tasa?.rateDate, '2026-06-12')
eq('sin tasa: importe null, nunca cero', analisis.nuevos[2].importeBase, null)
eq('cuenta los que necesitan tasa a mano', analisis.sinTasa, 1)
eq('divisas extranjeras detectadas', analisis.divisasExtranjeras, ['USD', 'KWD'])

console.log('--- filas a insertar ---')
let n = 0
const idFalso = () => `id-${++n}`
const incluida = construirFila(analisis.nuevos[0], 'user-1', idFalso, true)
eq('marcada como importada', incluida.source, 'card_import')
eq('conserva el identificador del proveedor', incluida.external_id, 'CARD-NUEVO')
eq('divisa y original siempre persistidos', [incluida.currency, incluida.original_amount, incluida.exchange_rate], ['EUR', 11.6, 1])
// La nota es el COMERCIO, no la descripción: la de Wise es una frase entera
// que repite el importe y en el Historial enterraba lo único legible.
eq('la nota prefiere el comercio', incluida.note, 'MERCADONA 4321')
eq(
  'sin comercio cae a la descripción',
  construirFila(
    { ...analisis.nuevos[0], movimiento: { ...analisis.nuevos[0].movimiento, merchant: '', description: 'Transacción con tarjeta' } },
    'user-1', idFalso, true
  ).note,
  'Transacción con tarjeta'
)
const descartada = construirFila(analisis.nuevos[1], 'user-1', idFalso, false)
eq('el descartado SE ESCRIBE, marcado', descartada.source, 'card_import_excluded')
eq('y conserva su external_id, que es lo que evita que reaparezca', descartada.external_id, 'CARD-USD')
eq('importe convertido en la fila', descartada.amount, 21.51)

let lanzo = false
try { construirFila(analisis.nuevos[2], 'user-1', idFalso, true) } catch { lanzo = true }
eq('sin tasa no se construye fila (nunca un importe inventado)', lanzo, true)

console.log('--- troceado ---')
const mil = Array.from({ length: 1000 }, (_, i) => i)
eq('1000 en dos bloques de 500', partirEnBloques(mil).map(b => b.length), [500, 500])
eq('501 en 500 + 1', partirEnBloques(Array.from({ length: 501 }, (_, i) => i)).map(b => b.length), [500, 1])
eq('vacío', partirEnBloques([]), [])
eq('rango de fechas', rangoDeFechas([
  mov({ externalId: 'a', date: '2026-06-14', amount: 1 }),
  mov({ externalId: 'b', date: '2026-05-02', amount: 1 }),
  mov({ externalId: 'c', date: '2026-06-30', amount: 1 }),
]), { desde: '2026-05-02', hasta: '2026-06-30' })
eq('rango de un extracto vacío', rangoDeFechas([]), null)

console.log('--- inserción: troceado y red de integridad ---')
function filaFalsa(i: number): FilaImportacion {
  return {
    id: `f-${i}`, user_id: 'u', amount: 1, category: 'Otros', date: '2026-06-14',
    note: '', is_recurring: false, source: 'card_import', external_id: `E-${i}`,
    card_last4: '0973', merchant: null, currency: 'EUR', original_amount: 1, exchange_rate: 1,
  }
}

function clienteFalso(opciones: {
  insertaDe?: (bloque: FilaImportacion[]) => number
  fallaEnBloque?: number
} = {}) {
  const bloques: number[] = []
  const opcionesVistas: Array<{ onConflict: string; ignoreDuplicates: boolean }> = []
  const cliente = {
    from() {
      return {
        upsert(filas: FilaImportacion[], opts: { onConflict: string; ignoreDuplicates: boolean }) {
          bloques.push(filas.length)
          opcionesVistas.push(opts)
          return {
            async select() {
              if (opciones.fallaEnBloque === bloques.length) {
                return { data: null, error: { message: 'fallo simulado' } }
              }
              const cuantas = opciones.insertaDe ? opciones.insertaDe(filas) : filas.length
              return { data: filas.slice(0, cuantas).map(f => ({ id: f.id })), error: null }
            },
          }
        },
      }
    },
  }
  return { cliente, bloques, opcionesVistas }
}

const mil2 = Array.from({ length: 1000 }, (_, i) => filaFalsa(i))
const a = clienteFalso()
const rA = await insertarFilas(a.cliente, mil2)
eq('trocea en 500', a.bloques, [500, 500])
eq('ignoreDuplicates siempre true', a.opcionesVistas.every(o => o.ignoreDuplicates === true), true)
eq('arbitra por (user_id, external_id)', a.opcionesVistas[0].onConflict, 'user_id,external_id')
eq('todas insertadas', [rA.solicitadas, rA.insertadas, rA.omitidasPorConflicto, rA.error], [1000, 1000, 0, null])

// La red de integridad se dispara: el proveedor omite filas ya existentes.
const b = clienteFalso({ insertaDe: filas => filas.length - 3 })
const rB = await insertarFilas(b.cliente, Array.from({ length: 10 }, (_, i) => filaFalsa(i)))
eq('detecta que se omitieron filas', [rB.insertadas, rB.omitidasPorConflicto], [7, 3])

// Fallo a mitad: se informa de lo que sí entró.
const c = clienteFalso({ fallaEnBloque: 2 })
const rC = await insertarFilas(c.cliente, mil2)
eq('no dice que no entró nada', [rC.insertadas, rC.error], [500, 'fallo simulado'])

console.log(`\n${pass} OK, ${fail} XX`)
if (fail > 0) process.exit(1)
