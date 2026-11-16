// Registra el resolvedor de src/ para las pruebas. Ver resolver-ts.mjs.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./resolver-ts.mjs', pathToFileURL('./scripts/'))
