// Tests de card-statement.ts
// Ejecutar: npm run test:statement
//
// La suite valida ESTRUCTURA (qué filas salen, cuántas, con qué id) y también
// VALOR: los tests de integración afirman importes concretos. Es deliberado —
// una versión anterior daba 62/62 en verde mientras todas sus fixtures
// producían importes x100, porque comprobaba ids, contadores y fechas pero
// nunca un amount.

import {
  parseCardStatement, detectDelimiter, normalizeDate, parseAmount, pad4,
  filterByCard, movementsWithoutCard, parseCSV, decodeStatementBytes,
} from './card-statement.ts'

let pass = 0, fail = 0
function eq(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log(`${ok ? 'OK ' : 'XX '} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (esperado ' + JSON.stringify(exp) + ')'}`)
  ok ? pass++ : fail++
}

const H = 'TransferWise ID;Date;Amount;Currency;Description;Merchant;Card Last Four Digits;Transaction Type;Transaction Details Type'

// ============================================================
// 1. Suite original
// ============================================================
console.log('--- suite original ---')
eq('detectDelimiter ;', detectDelimiter('a;b;c'), ';')
eq('detectDelimiter ,', detectDelimiter('a,b,c'), ',')
eq('normalizeDate DD-MM-YYYY', normalizeDate('27-08-2026'), '2026-08-27')
eq('normalizeDate YYYY-MM-DD', normalizeDate('2026-08-27'), '2026-08-27')
eq('normalizeDate inválida', normalizeDate('agosto'), null)
eq('parseAmount punto', parseAmount('-11.60', '.'), -11.6)
eq('parseAmount coma', parseAmount('-11,60', ','), -11.6)
eq('parseAmount basura', parseAmount('N/A', '.'), null)
eq('pad4 cero inicial', pad4('973'), '0973')

const csv = [H,
  'CARD-1;27-08-2026;-11,60;EUR;Compra A;Shein;973;DEBIT;CARD',
  'CARD-2;fecha-mala;-5,00;EUR;Compra B;Bar;973;DEBIT;CARD',
  'CARD-3;27-08-2026;N/A;EUR;Compra C;Taxi;973;DEBIT;CARD',
  'CARD-4;26-08-2026;-99,00;USD;Compra D;Amazon;4242;DEBIT;CARD',
  'CARD-5;27-08-2026;5,00;EUR;Reembolso;Shein;973;CREDIT;CARD',
  'TR-1;25-08-2026;-40,00;EUR;Alquiler;;;DEBIT;TRANSFER',
  'CARD-1;27-08-2026;-11,60;EUR;Compra A;Shein;973;DEBIT;CARD',
].join('\n')

const res = parseCardStatement(csv)
eq('provider', res.provider, 'wise')
eq('movements (dedup)', res.movements.map(m => m.externalId), ['CARD-1', 'CARD-4'])
eq('credits (reembolso)', res.credits.map(m => m.externalId), ['CARD-5'])
eq('excluded motivos', res.excluded.map(e => e.reason), ['fecha_invalida', 'importe_invalido'])
eq('nonCardCount (transferencia)', res.nonCardCount, 1)
eq('cards presentes', res.cards.sort(), ['0973', '4242'])
eq('currencies', res.currencies, { EUR: 1, USD: 1 })
eq('dateMin', res.dateMin, '2026-08-26')
eq('dateMax', res.dateMax, '2026-08-27')
eq('last4 0973 con cero', res.movements.find(m => m.externalId === 'CARD-1')?.cardLast4, '0973')
eq('filterByCard 0973', filterByCard(res.movements, '0973').map(m => m.externalId), ['CARD-1'])
eq('filterByCard 973 (normaliza)', filterByCard(res.movements, '973').map(m => m.externalId), ['CARD-1'])
eq('duplicatesInFile base', res.duplicatesInFile, 1)

// ============================================================
// 2. LA COBERTURA QUE FALTABA: los importes
// ============================================================
// Esto es lo que la suite de la v3 no comprobaba en ningún sitio, y es lo
// único que habría detectado el x100.
console.log('\n--- IMPORTES en integración (cobertura que faltaba) ---')
eq('amount CARD-1 = 11.6, no 1160', res.movements.find(m => m.externalId === 'CARD-1')?.amount, 11.6)
eq('amount CARD-4 = 99, no 9900', res.movements.find(m => m.externalId === 'CARD-4')?.amount, 99)
eq('amount crédito CARD-5 = 5, no 500', res.credits.find(m => m.externalId === 'CARD-5')?.amount, 5)
eq('todos los importes < 1000', res.movements.every(m => m.amount < 1000), true)

// ============================================================
// 3. parseAmount: tabla de decisión completa
// ============================================================
console.log('\n--- parseAmount nivel 1: ambos separadores (universal) ---')
eq('1.234,56', parseAmount('1.234,56', '.'), 1234.56)
eq('1,234.56', parseAmount('1,234.56', '.'), 1234.56)
eq('1.234.567,89', parseAmount('1.234.567,89', '.'), 1234567.89)
eq('el decimal declarado no altera el nivel 1', parseAmount('1.234,56', ','), 1234.56)
eq('grupo de miles inválido -> null', parseAmount('1.23,456', '.'), null)

console.log('\n--- parseAmount nivel 2: la estructura descarta una lectura ---')
// 2 dígitos tras el separador: imposible como miles -> decimal, sea cual sea
// el separador declarado. Es lo que evita el x100.
eq('11,60 con punto declarado', parseAmount('11,60', '.'), 11.6)
eq('11,60 con coma declarada', parseAmount('11,60', ','), 11.6)
eq('5,00 con punto declarado', parseAmount('5,00', '.'), 5)
eq('0,75 con punto declarado', parseAmount('0,75', '.'), 0.75)
eq('11.6 (1 dígito)', parseAmount('11.6', ','), 11.6)
// Varios separadores iguales: imposible como decimal -> miles
eq('1.234.567 sin decimales', parseAmount('1.234.567', '.'), 1234567)
eq('1,234,567 sin decimales', parseAmount('1,234,567', ','), 1234567)
// Ni miles ni decimal
eq('1.23.456 -> null', parseAmount('1.23.456', '.'), null)

console.log('\n--- parseAmount nivel 3: ambiguo, decide el proveedor ---')
eq('12.500 punto-decimal = 12,5 (KWD)', parseAmount('12.500', '.'), 12.5)
eq('12.500 coma-decimal = 12500', parseAmount('12.500', ','), 12500)
eq('0.750 punto-decimal = 0,75', parseAmount('0.750', '.'), 0.75)
eq('100.000 punto-decimal = 100', parseAmount('100.000', '.'), 100)
eq('100.000 coma-decimal = 100000', parseAmount('100.000', ','), 100000)
eq('1.234 punto-decimal = 1,234', parseAmount('1.234', '.'), 1.234)
eq('1.234 coma-decimal = 1234', parseAmount('1.234', ','), 1234)

console.log('\n--- parseAmount: signo y bordes ---')
eq('minus final 40,00-', parseAmount('40,00-', ','), -40)
eq('minus final con punto', parseAmount('40.00-', '.'), -40)
eq('signo +', parseAmount('+12,50', ','), 12.5)
eq('cero legítimo', parseAmount('0,00', ','), 0)
eq('sin separador', parseAmount('1234', '.'), 1234)
eq('vacío -> null', parseAmount('', '.'), null)
eq('null -> null', parseAmount(null, '.'), null)

// ============================================================
// 4. Divisa de 3 decimales de extremo a extremo
// ============================================================
console.log('\n--- KWD de extremo a extremo ---')
const kwd = parseCardStatement([H,
  'K-1;27-08-2026;-12.500;KWD;Souq;Souq;973;DEBIT;CARD',
  'K-2;27-08-2026;-0.750;KWD;Cafe;Cafe;973;DEBIT;CARD',
].join('\n'))
eq('12.500 KWD = 12,5', kwd.movements.find(m => m.externalId === 'K-1')?.amount, 12.5)
eq('0.750 KWD = 0,75', kwd.movements.find(m => m.externalId === 'K-2')?.amount, 0.75)
eq('divisa KWD', kwd.currencies, { KWD: 2 })

// ============================================================
// 5. Resto de la cobertura de la v3 (regresión)
// ============================================================
console.log('\n--- columnas de tipo obligatorias ---')
try {
  parseCardStatement([
    'TransferWise ID;Date;Amount;Currency;Description;Merchant;Card Last Four Digits;Transaction Type',
    'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;DEBIT',
  ].join('\n'))
  eq('sin Details Type -> lanza', 'no lanzó', 'debería lanzar')
} catch (e) {
  const msg = (e as Error).message
  eq('sin Details Type -> lanza', msg.includes('tipo de detalle'), true)
  eq('no filtra la marca', /transferwise/i.test(msg), false)
}
try {
  parseCardStatement([
    'TransferWise ID;Date;Amount;Currency;Description;Merchant;Card Last Four Digits;Transaction Details Type',
    'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;CARD',
  ].join('\n'))
  eq('sin Transaction Type -> lanza', 'no lanzó', 'debería lanzar')
} catch (e) {
  eq('sin Transaction Type -> lanza', (e as Error).message.includes('tipo de movimiento'), true)
}

console.log('\n--- dedup intra-lote observable ---')
const dup = parseCardStatement([H,
  'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;DEBIT;CARD',
  'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;DEBIT;CARD',
  'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;DEBIT;CARD',
].join('\n'))
eq('movements tras dedup', dup.movements.length, 1)
eq('duplicatesInFile', dup.duplicatesInFile, 2)

console.log('\n--- tipo de tarjeta no reconocido ---')
const hold = parseCardStatement([H,
  'CARD-9;27-08-2026;-11,60;EUR;A;Shein;973;HOLD;CARD',
  'TR-1;25-08-2026;-40,00;EUR;Alquiler;;;DEBIT;TRANSFER',
].join('\n'))
eq('unknownCardTypeCount', hold.unknownCardTypeCount, 1)
eq('nonCardCount no lo absorbe', hold.nonCardCount, 1)

console.log('\n--- nº de línea real ---')
const blancos = parseCardStatement([H,
  'CARD-1;27-08-2026;-11,60;EUR;A;Shein;973;DEBIT;CARD',
  '',
  '',
  'CARD-2;fecha-mala;-5,00;EUR;B;Bar;973;DEBIT;CARD',
].join('\n'))
eq('línea real (5, no 2)', blancos.excluded.map(e => e.line), [5])
eq('parseCSV conserva líneas', parseCSV('a;b\n\n\nc;d', ';').map(r => r.line), [1, 4])

console.log('\n--- divisa en mayúsculas ---')
eq('currency normalizada', parseCardStatement([H, 'C-1;27-08-2026;-11,60;eur;A;S;973;DEBIT;CARD'].join('\n')).currencies, { EUR: 1 })

console.log('\n--- ids sintéticos ---')
const gemelas = parseCardStatement([H,
  ';27-08-2026;-4,50;EUR;Cafe;Bar Pepe;973;DEBIT;CARD',
  ';27-08-2026;-4,50;EUR;Cafe;Bar Pepe;973;DEBIT;CARD',
].join('\n'))
eq('dos compras idénticas se conservan', gemelas.movements.length, 2)
eq('ids distintos', gemelas.movements[0].externalId !== gemelas.movements[1].externalId, true)
eq('duplicatesInFile = 0', gemelas.duplicatesInFile, 0)
eq('syntheticIdCount', gemelas.syntheticIdCount, 2)
eq('importe correcto en sintéticos', gemelas.movements[0].amount, 4.5)
// toFixed(4) en la base: dos importes que solo difieren en el 3er decimal
// son movimientos DISTINTOS, no repeticiones del mismo
const kwdSynth = parseCardStatement([H,
  ';27-08-2026;-12.500;KWD;A;Souq;973;DEBIT;CARD',
  ';27-08-2026;-12.504;KWD;A;Souq;973;DEBIT;CARD',
].join('\n'))
eq('3er decimal distingue la base del id', kwdSynth.movements.map(m => m.amount), [12.5, 12.504])
eq('ambos conservados', kwdSynth.movements.length, 2)
eq('no cuentan como repetición', kwdSynth.duplicatesInFile, 0)

console.log('\n--- tarjeta ausente en la celda ---')
const sinTarjeta = parseCardStatement([H,
  'CARD-1;27-08-2026;-11,60;EUR;A;Shein;;DEBIT;CARD',
  'CARD-2;27-08-2026;-1,00;EUR;B;Bar;973;DEBIT;CARD',
].join('\n'))
eq('missingLast4', sinTarjeta.missingLast4, 1)
eq('no contamina las tarjetas', sinTarjeta.cards, ['0973'])
eq('filterByCard no los arrastra', filterByCard(sinTarjeta.movements, '973').map(m => m.externalId), ['CARD-2'])
eq('filterByCard vacío -> nada', filterByCard(sinTarjeta.movements, '').length, 0)
eq('movementsWithoutCard los aísla', movementsWithoutCard(sinTarjeta.movements).map(m => m.externalId), ['CARD-1'])

console.log('\n--- codificación ---')
const utf8 = new TextEncoder().encode('Café;1')
eq('UTF-8 válido', decodeStatementBytes(utf8).encoding, 'utf-8')
const latin = new Uint8Array([0x43, 0x61, 0x66, 0xE9, 0x3B, 0x31])
eq('cae a latin1', decodeStatementBytes(latin).encoding, 'latin1')
eq('latin1 decodifica bien', decodeStatementBytes(latin).text, 'Café;1')
eq('codificación forzada', decodeStatementBytes(utf8, 'latin1').encoding, 'latin1')

// ============================================================
// 6. FORMATO REAL DEL PROVEEDOR (coma delimitador, punto decimal)
// ============================================================
// Todas las fixtures anteriores usan ';' + coma decimal, que NO es lo que
// Wise exporta. El export real usa COMA delimitador y PUNTO decimal, con
// campos entrecomillados que contienen comas. Sin esta cobertura, la suite
// nunca ejercita el formato que producción recibe de verdad.
console.log('\n--- formato real de Wise (coma delim, punto decimal) ---')
const HR = 'TransferWise ID,Date,Amount,Currency,Description,Merchant,Card Last Four Digits,Transaction Type,Transaction Details Type'
const realWise = [HR,
  'CARD-1,27-08-2026,-3.61,EUR,"Compra, con coma",Shein Dublin,973,DEBIT,CARD',
  'CARD-2,26-08-2026,-11.60,EUR,Compra,Eur.shein.com,973,DEBIT,CARD',
  'CARD-3,26-08-2026,-1234.56,EUR,Compra grande,Tienda,973,DEBIT,CARD',
].join('\n')
const rr = parseCardStatement(realWise)
eq('delimitador coma detectado (3 movimientos)', rr.movements.length, 3)
eq('importe con punto decimal 3.61', rr.movements.find(m=>m.externalId==='CARD-1')?.amount, 3.61)
eq('importe 11.60 no x100', rr.movements.find(m=>m.externalId==='CARD-2')?.amount, 11.6)
eq('importe grande 1234.56', rr.movements.find(m=>m.externalId==='CARD-3')?.amount, 1234.56)
eq('coma dentro de campo entrecomillado no rompe', rr.movements.find(m=>m.externalId==='CARD-1')?.description, 'Compra, con coma')

console.log(`\n${pass} OK, ${fail} XX`)
process.exit(fail ? 1 : 0)
