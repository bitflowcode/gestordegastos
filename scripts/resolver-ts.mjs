// Resolvedor para ejecutar módulos de la aplicación con `node --experimental-strip-types`.
//
// El código de src/ importa sin extensión ('./currency'), que es lo que espera
// el empaquetador de Next, mientras que Node en modo ESM exige la extensión.
// En vez de ensuciar el código de la aplicación con extensiones '.ts' —que
// además obligarían a activar allowImportingTsExtensions—, se resuelve aquí,
// solo para las pruebas.
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(especificador)) {
    const base = new URL(especificador, contexto.parentURL)
    for (const extension of ['.ts', '.mts', '/index.ts']) {
      const candidato = new URL(base.href + extension)
      if (existsSync(fileURLToPath(candidato))) {
        return siguiente(candidato.href, contexto)
      }
    }
  }
  return siguiente(especificador, contexto)
}
