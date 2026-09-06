// ============================================================
// merchant-category.ts
// Sugerencia de categoría a partir del comercio y la descripción.
//
// Unifica las dos heurísticas que vivían duplicadas y divergentes en
// use-tesseract-ocr.ts y en el webhook de n8n, y corrige lo que ambas hacían
// mal:
//
//   * Inventaban categorías. Asignaban 'Restaurante', 'Farmacia', 'Ropa' o
//     'Hogar', que no están entre las del usuario, y `category` es texto libre
//     sin clave ajena: la categoría entraba en la base y luego no aparecía en
//     ningún filtro ni en la leyenda del gráfico. Aquí la sugerencia se resuelve
//     SIEMPRE contra las categorías que el usuario ya tiene.
//   * Buscaban con includes() sobre el texto entero, sin límites de palabra. Con
//     'dia' en la lista de Alimentación, MEDIAMARKT se categorizaba como
//     supermercado. Aquí se compara por palabras completas.
//
// Ante la duda, 'Otros': una categoría equivocada distorsiona el gráfico en
// silencio, mientras que 'Otros' se ve y se corrige.
//
// Limitación conocida y aceptada: las palabras clave tienen sesgo geográfico
// español. Añadir un país es añadir entradas a REGLAS, sin tocar el resto.
// ============================================================

/**
 * Concepto detectado en el texto. No es la categoría final: es lo que se ha
 * reconocido, y `candidatos` dice a qué categorías del usuario puede ir, de la
 * más específica a la más general. Así, quien tenga una categoría 'Restaurante'
 * la recibe, y quien no, lo ve en 'Alimentación' en vez de en una categoría
 * nueva que nadie ha creado.
 */
interface Concepto {
  candidatos: string[]
  palabras: string[]
}

const REGLAS: Concepto[] = [
  {
    candidatos: ['Alimentación', 'Comida', 'Supermercado'],
    palabras: [
      'supermercado', 'super', 'mercado', 'alimentacion', 'comida', 'panaderia',
      'fruteria', 'carniceria', 'pescaderia', 'ultramarinos',
      'mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo',
      'consum', 'ahorramas', 'hipercor', 'bonarea', 'condis', 'caprabo', 'gadis',
    ],
  },
  {
    candidatos: ['Restaurante', 'Restaurantes', 'Alimentación'],
    palabras: [
      'restaurante', 'restaurant', 'bar', 'cafeteria', 'cafe', 'coffee',
      'tapas', 'cerveceria', 'pizzeria', 'pizza', 'burger', 'sushi', 'kebab',
      'mcdonalds', 'burger king', 'telepizza', 'dominos', 'kfc', 'goiko',
      'starbucks', 'glovo', 'just eat', 'uber eats', 'deliveroo',
    ],
  },
  {
    candidatos: ['Transporte'],
    palabras: [
      'gasolina', 'gasolinera', 'combustible', 'carburante', 'peaje', 'parking',
      'aparcamiento', 'taxi', 'metro', 'autobus', 'bus', 'tren', 'billete',
      'repsol', 'cepsa', 'galp', 'shell', 'bp', 'petronor', 'ballenoil',
      'uber', 'cabify', 'bolt', 'blablacar', 'renfe', 'alsa', 'emt', 'iberia',
      'vueling', 'ryanair', 'easyjet',
    ],
  },
  {
    candidatos: ['Salud'],
    palabras: [
      'farmacia', 'parafarmacia', 'medicamento', 'medicina', 'hospital',
      'clinica', 'medico', 'dentista', 'optica', 'fisioterapia', 'analisis',
      'sanitas', 'adeslas', 'dkv', 'asisa',
    ],
  },
  {
    candidatos: ['Entretenimiento', 'Ocio'],
    palabras: [
      'cine', 'teatro', 'concierto', 'entrada', 'museo', 'gimnasio', 'gym',
      'netflix', 'spotify', 'hbo', 'disney', 'filmin', 'movistar', 'dazn',
      'playstation', 'xbox', 'nintendo', 'steam', 'twitch',
    ],
  },
  {
    candidatos: ['Vivienda', 'Hogar'],
    palabras: [
      'alquiler', 'hipoteca', 'comunidad', 'luz', 'electricidad', 'agua', 'gas',
      'internet', 'fibra', 'ferreteria', 'bricolaje', 'muebles', 'decoracion',
      'ikea', 'leroy merlin', 'bricomart', 'bricodepot', 'endesa', 'iberdrola',
      'naturgy', 'holaluz', 'vodafone', 'orange', 'jazztel', 'pepephone',
    ],
  },
  {
    candidatos: ['Educación'],
    palabras: [
      'curso', 'formacion', 'academia', 'universidad', 'colegio', 'matricula',
      'libreria', 'libro', 'udemy', 'coursera', 'domestika',
    ],
  },
  {
    candidatos: ['Ropa', 'Moda', 'Compras'],
    palabras: [
      'ropa', 'moda', 'calzado', 'zapateria', 'zara', 'mango', 'bershka',
      'pull bear', 'stradivarius', 'massimo dutti', 'primark', 'decathlon',
      'nike', 'adidas', 'shein',
    ],
  },
]

/** Categoría de último recurso. Visible y corregible, nunca una adivinada. */
const CATEGORIA_DUDA = 'Otros'

/**
 * Minúsculas, sin acentos y con todo lo que no sea letra o número convertido en
 * separador. Las descripciones de extracto vienen en mayúsculas y con ruido
 * alrededor del comercio: 'COMPRA EN MERCADONA 4321 VALENCIA',
 * 'AMZN Mktp ES*1A2B3', 'PAYPAL *SPOTIFY'.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * ¿Aparece la clave como palabra o secuencia de palabras completas?
 *
 * Con includes() a secas, 'dia' casaba dentro de 'mediamarkt' y 'bar' dentro de
 * 'barcelona'. Los espacios de guarda evitan justo eso.
 */
function contienePalabra(textoNormalizado: string, clave: string): boolean {
  return ` ${textoNormalizado} `.includes(` ${clave} `)
}

/**
 * Categoría sugerida para un comercio, resuelta contra las categorías del
 * usuario. Devuelve null solo si no hay ninguna donde ponerla, ni siquiera
 * 'Otros': en ese caso quien llame debe pedir al usuario que elija, nunca
 * inventarse una.
 */
export function sugerirCategoria(
  texto: string,
  categoriasUsuario: string[]
): string | null {
  const normalizado = normalizarTexto(texto)
  const porNombre = new Map(categoriasUsuario.map(c => [normalizarTexto(c), c]))
  const resolver = (nombre: string) => porNombre.get(normalizarTexto(nombre)) ?? null

  if (normalizado !== '') {
    for (const regla of REGLAS) {
      if (!regla.palabras.some(p => contienePalabra(normalizado, p))) continue
      for (const candidato of regla.candidatos) {
        const existente = resolver(candidato)
        if (existente) return existente
      }
      // Reconocido pero sin sitio: es una duda, no un acierto.
      break
    }
  }

  return resolver(CATEGORIA_DUDA)
}
