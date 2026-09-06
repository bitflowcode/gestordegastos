// Tests de currency.ts
// Ejecutar: npm run test:currency
//
// Comprueban VALOR, no solo forma: qué tasa concreta se aplica a una fecha y de
// qué día es esa tasa. Una suite que solo mirase "devuelve algo" daría verde con
// la tasa del día equivocado, que es el fallo que importa aquí.

import {
  isCurrencyCode, isIsoDate, resolveRateForDate, addDays, DEFAULT_TARGET_CURRENCY,
} from './currency.ts'

let pass = 0, fail = 0
function eq(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log(`${ok ? 'OK ' : 'XX '} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (esperado ' + JSON.stringify(exp) + ')'}`)
  ok ? pass++ : fail++
}

console.log('--- divisa de destino ---')
eq('el euro se resuelve desde un único punto', DEFAULT_TARGET_CURRENCY, 'EUR')

console.log('--- códigos de divisa ---')
eq('USD válido', isCurrencyCode('USD'), true)
eq('minúsculas no', isCurrencyCode('usd'), false)
eq('cuatro letras no', isCurrencyCode('USDX'), false)
eq('vacío no', isCurrencyCode(''), false)
eq('inyección de ruta no', isCurrencyCode('../x'), false)

console.log('--- fechas ---')
eq('fecha normal', isIsoDate('2026-06-14'), true)
eq('29 de febrero bisiesto', isIsoDate('2024-02-29'), true)
eq('29 de febrero no bisiesto', isIsoDate('2023-02-29'), false)
eq('31 de febrero', isIsoDate('2026-02-31'), false)
eq('mes 13', isIsoDate('2026-13-01'), false)
eq('día 0', isIsoDate('2026-06-00'), false)
eq('formato con barras', isIsoDate('2026/06/14'), false)
eq('con hora', isIsoDate('2026-06-14T10:00:00'), false)

console.log('--- resolución de la tasa por fecha ---')
// Serie real del BCE, USD->EUR: el 8 y el 9 de junio de 2024 son sábado y
// domingo, y no tienen publicación.
const serie = {
  '2024-06-06': 0.9205,
  '2024-06-07': 0.9176,
  '2024-06-10': 0.9268,
}
eq('día hábil: su propia tasa', resolveRateForDate(serie, '2024-06-07'), { rate: 0.9176, rateDate: '2024-06-07' })
eq('sábado: cae al viernes', resolveRateForDate(serie, '2024-06-08'), { rate: 0.9176, rateDate: '2024-06-07' })
eq('domingo: también al viernes', resolveRateForDate(serie, '2024-06-09'), { rate: 0.9176, rateDate: '2024-06-07' })
eq('lunes: su propia tasa, no la del viernes', resolveRateForDate(serie, '2024-06-10'), { rate: 0.9268, rateDate: '2024-06-10' })
eq('posterior a la serie: última publicada', resolveRateForDate(serie, '2024-06-30'), { rate: 0.9268, rateDate: '2024-06-10' })
eq('anterior a la serie: nada, nunca una aproximación', resolveRateForDate(serie, '2024-06-05'), null)
eq('serie vacía', resolveRateForDate({}, '2024-06-07'), null)

// El orden de las claves no debe influir: si se recorriera el objeto sin
// ordenar, la elección dependería del orden de inserción del JSON recibido.
const desordenada = {
  '2024-06-10': 0.9268,
  '2024-06-06': 0.9205,
  '2024-06-07': 0.9176,
}
eq('serie desordenada da lo mismo', resolveRateForDate(desordenada, '2024-06-08'), { rate: 0.9176, rateDate: '2024-06-07' })

console.log('--- aritmética de fechas ---')
eq('resta simple', addDays('2024-06-10', -3), '2024-06-07')
eq('cruza el mes', addDays('2024-06-01', -1), '2024-05-31')
eq('cruza el año', addDays('2025-01-01', -1), '2024-12-31')
eq('29 de febrero bisiesto', addDays('2024-03-01', -1), '2024-02-29')
eq('28 de febrero no bisiesto', addDays('2023-03-01', -1), '2023-02-28')
eq('suma', addDays('2024-06-28', 5), '2024-07-03')

console.log(`\n${pass} OK, ${fail} XX`)
if (fail > 0) process.exit(1)
