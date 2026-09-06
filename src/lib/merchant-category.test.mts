// Tests de merchant-category.ts
// Ejecutar: npm run test:category
//
// Comprueban QUÉ categoría sale, no que salga alguna, y con las cadenas tal y
// como vienen en un extracto: mayúsculas, número de tienda, ciudad, asteriscos
// de pasarela. Buena parte de la suite son los dos fallos que tenían las
// heurísticas anteriores: categorías inventadas y coincidencias a media palabra.

import { sugerirCategoria, normalizarTexto } from './merchant-category.ts'

let pass = 0, fail = 0
function eq(label: string, got: unknown, exp: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(exp)
  console.log(`${ok ? 'OK ' : 'XX '} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (esperado ' + JSON.stringify(exp) + ')'}`)
  ok ? pass++ : fail++
}

// Las categorías por defecto de la aplicación.
const DEFECTO = ["Alimentación", "Transporte", "Vivienda", "Entretenimiento", "Salud", "Educación", "Otros"]

console.log('--- normalización ---')
eq('mayúsculas y acentos', normalizarTexto('ALIMENTACIÓN'), 'alimentacion')
eq('asteriscos de pasarela', normalizarTexto('PAYPAL *SPOTIFY'), 'paypal spotify')
eq('ruido de extracto', normalizarTexto('COMPRA EN MERCADONA 4321 VALENCIA'), 'compra en mercadona 4321 valencia')
eq('vacío', normalizarTexto('   '), '')

console.log('--- cadenas de extracto ---')
eq('supermercado con nº de tienda', sugerirCategoria('MERCADONA 4321 VALENCIA', DEFECTO), 'Alimentación')
eq('gasolinera', sugerirCategoria('REPSOL E.S. 12345', DEFECTO), 'Transporte')
eq('farmacia', sugerirCategoria('FARMACIA CENTRAL MADRID', DEFECTO), 'Salud')
eq('suscripción vía pasarela', sugerirCategoria('PAYPAL *SPOTIFY', DEFECTO), 'Entretenimiento')
eq('eléctrica', sugerirCategoria('IBERDROLA CLIENTES SAU', DEFECTO), 'Vivienda')
eq('formación', sugerirCategoria('UDEMY ONLINE COURSES', DEFECTO), 'Educación')
eq('comercio desconocido -> Otros', sugerirCategoria('TIENDA PEPE SL', DEFECTO), 'Otros')
eq('descripción vacía -> Otros', sugerirCategoria('', DEFECTO), 'Otros')

console.log('--- coincidencias a media palabra (el fallo de includes) ---')
// 'dia' es un supermercado y estaba en la lista de Alimentación: con includes()
// sobre el texto entero, estas tres compras acababan de supermercado.
eq('MEDIAMARKT no es Alimentación', sugerirCategoria('MEDIAMARKT MADRID', DEFECTO), 'Otros')
eq('GUARDIA no es Alimentación', sugerirCategoria('CUERPO GUARDIA', DEFECTO), 'Otros')
eq('COMEDIA no es Alimentación', sugerirCategoria('CLUB COMEDIA', DEFECTO), 'Otros')
// 'bar' estaba en la lista de restauración.
eq('BARCELONA no es restauración', sugerirCategoria('HOTEL BARCELONA', DEFECTO), 'Otros')
// Y las palabras completas sí tienen que casar.
eq('DIA como palabra sí es Alimentación', sugerirCategoria('SUPERMERCADOS DIA 887', DEFECTO), 'Alimentación')
eq('BAR como palabra sí es restauración', sugerirCategoria('BAR MANOLO', DEFECTO), 'Alimentación')

console.log('--- nunca inventa categorías ---')
// Un restaurante con las categorías por defecto, donde no existe 'Restaurante'.
eq('restaurante cae en Alimentación', sugerirCategoria('GOIKO GRILL', DEFECTO), 'Alimentación')
// Y si el usuario sí tiene esa categoría, la recibe.
eq('restaurante va a su categoría si existe', sugerirCategoria('GOIKO GRILL', DEFECTO.concat(['Restaurante'])), 'Restaurante')
// Ropa no tiene sitio en las de por defecto: es duda, no Alimentación.
eq('ropa sin categoría propia -> Otros', sugerirCategoria('ZARA ESPAÑA', DEFECTO), 'Otros')
eq('ropa con categoría propia', sugerirCategoria('ZARA ESPAÑA', DEFECTO.concat(['Moda'])), 'Moda')
// La sugerencia sale SIEMPRE de la lista del usuario.
const PERSONALIZADAS = ['comida', 'coche', 'otros']
eq('respeta el nombre exacto del usuario', sugerirCategoria('MERCADONA 4321', PERSONALIZADAS), 'comida')
eq('acentos y mayúsculas del usuario', sugerirCategoria('MERCADONA', ['ALIMENTACION']), 'ALIMENTACION')
eq('sin ninguna categoría donde caer', sugerirCategoria('MERCADONA', ['Coche']), null)
eq('sin categorías en absoluto', sugerirCategoria('MERCADONA', []), null)

console.log(`\n${pass} OK, ${fail} XX`)
if (fail > 0) process.exit(1)
