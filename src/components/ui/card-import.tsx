"use client"

// ============================================================
// card-import.tsx
// Pestaña "Tarjetas": subir un extracto CSV, revisar la previsualización y
// confirmar la importación.
//
// Este componente solo ORQUESTA. Todas las decisiones delicadas (qué es nuevo,
// qué ya está, qué se parece a un gasto manual, cómo se trocea la inserción)
// viven en src/lib/card-import.ts y están probadas allí. Aquí no se duplica
// ninguna de esas reglas: se llama a la lógica y se pinta el resultado.
// ============================================================

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatCurrency, generateUUID } from "@/lib/utils"
import {
  CardStatementError,
  decodeStatementBytes,
  parseCardStatement,
  type ParseResult,
} from "@/lib/card-statement"
import {
  MARGEN_DIAS,
  analizarExtracto,
  buscarPosiblesDuplicados,
  construirFila,
  insertarFilas,
  rangoDeFechas,
  redondearImporte,
  type ClienteInsercion,
  type GastoExistente,
  type MovimientoAnalizado,
  type ResultadoInsercion,
  type TasaAplicada,
} from "@/lib/card-import"
import { DEFAULT_TARGET_CURRENCY, MAX_DATES_PER_REQUEST, addDays } from "@/lib/currency"

interface CardImportProps {
  /** Vacío en modo invitado: el importador necesita cuenta. */
  userId: string
  categories: string[]
  /** Refresca los gastos en memoria tras importar (reload del hook). */
  onImported: () => void | Promise<void>
}

/**
 * Fila de la previsualización: el análisis de la lógica pura más lo que el
 * usuario puede tocar (incluir o no, categoría, tasa tecleada a mano).
 */
interface FilaRevision {
  analizado: MovimientoAnalizado
  incluir: boolean
}

type Fase = "inicio" | "analizando" | "revision" | "importando" | "hecho"

/** Respuesta de /api/fx para un lote de fechas de una divisa. */
interface RespuestaFx {
  rates: Record<string, { rate: number; rateDate: string } | null>
}

/**
 * Tasas históricas para todas las divisas extranjeras del extracto.
 *
 * Un fallo aquí no es un error de la importación: la fecha se queda sin tasa,
 * el análisis la cuenta en `sinTasa` y el usuario la teclea. Es el mecanismo
 * previsto de corrección, no un camino degradado.
 */
async function pedirTasas(
  movimientos: { currency: string; date: string }[]
): Promise<Record<string, Record<string, TasaAplicada>>> {
  const fechasPorDivisa = new Map<string, Set<string>>()
  for (const m of movimientos) {
    if (m.currency === DEFAULT_TARGET_CURRENCY) continue
    if (!fechasPorDivisa.has(m.currency)) fechasPorDivisa.set(m.currency, new Set())
    fechasPorDivisa.get(m.currency)!.add(m.date)
  }

  const tasas: Record<string, Record<string, TasaAplicada>> = {}
  await Promise.all(
    Array.from(fechasPorDivisa.entries()).map(async ([divisa, fechasSet]) => {
      tasas[divisa] = {}
      const fechas = Array.from(fechasSet).sort()
      for (let i = 0; i < fechas.length; i += MAX_DATES_PER_REQUEST) {
        const lote = fechas.slice(i, i + MAX_DATES_PER_REQUEST)
        try {
          const res = await fetch(`/api/fx?from=${divisa}&dates=${lote.join(",")}`)
          if (!res.ok) continue
          const json: RespuestaFx = await res.json()
          for (const fecha of Object.keys(json.rates || {})) {
            const r = json.rates[fecha]
            if (r) tasas[divisa][fecha] = { rate: r.rate, rateDate: r.rateDate }
          }
        } catch {
          // Sin red: estas fechas quedan sin tasa y se teclean a mano.
        }
      }
    })
  )
  return tasas
}

export function CardImport({ userId, categories, onImported }: CardImportProps) {
  const [fase, setFase] = useState<Fase>("inicio")
  const [error, setError] = useState<string | null>(null)
  const [parse, setParse] = useState<ParseResult | null>(null)
  const [filas, setFilas] = useState<FilaRevision[]>([])
  const [yaImportados, setYaImportados] = useState(0)
  const [descartadosAntes, setDescartadosAntes] = useState(0)
  const [existentes, setExistentes] = useState<GastoExistente[]>([])
  const [resultado, setResultado] = useState<ResultadoInsercion | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const puedeImportar = !!userId && !!supabase

  const reiniciar = () => {
    setFase("inicio")
    setError(null)
    setParse(null)
    setFilas([])
    setResultado(null)
  }

  // ---------- paso 1: archivo -> previsualización ----------
  const analizarArchivo = async (file: File) => {
    if (!puedeImportar || !supabase) return
    setFase("analizando")
    setError(null)

    try {
      const { text } = decodeStatementBytes(await file.arrayBuffer())
      const resultadoParse = parseCardStatement(text)
      const rango = rangoDeFechas(resultadoParse.movements)

      if (!rango) {
        setParse(resultadoParse)
        setFilas([])
        setYaImportados(0)
        setDescartadosAntes(0)
        setFase("revision")
        return
      }

      // Consulta de deduplicación: acotada al rango del extracto ampliado con
      // el margen difuso, y SIN filtrar por source. Los excluidos tienen que
      // venir: su external_id es lo que impide que un movimiento descartado
      // vuelva a ofrecerse al reimportar.
      const { data, error: dbError } = await supabase
        .from("user_expenses")
        .select("id,date,amount,category,note,source,external_id")
        .eq("user_id", userId)
        .gte("date", addDays(rango.desde, -MARGEN_DIAS))
        .lte("date", addDays(rango.hasta, MARGEN_DIAS))

      if (dbError) throw new Error(`No se pudieron consultar los gastos existentes: ${dbError.message}`)

      const gastosExistentes: GastoExistente[] = (data || []).map(g => ({
        id: g.id,
        date: g.date,
        amount: g.amount,
        category: g.category,
        note: g.note || "",
        source: g.source || "manual",
        externalId: g.external_id ?? null,
      }))

      const tasas = await pedirTasas(resultadoParse.movements)
      const analisis = analizarExtracto(resultadoParse.movements, gastosExistentes, categories, tasas)

      setParse(resultadoParse)
      setExistentes(gastosExistentes)
      setFilas(analisis.nuevos.map(analizado => ({ analizado, incluir: true })))
      setYaImportados(analisis.yaImportados.length)
      setDescartadosAntes(analisis.descartadosAntes.length)
      setFase("revision")
    } catch (e) {
      setError(
        e instanceof CardStatementError
          ? e.message
          : e instanceof Error
            ? e.message
            : "No se pudo leer el archivo."
      )
      setFase("inicio")
    }
  }

  // ---------- edición de la previsualización ----------
  const cambiarFila = (i: number, cambio: Partial<FilaRevision> | { categoria: string } | { tasaManual: number | null }) => {
    setFilas(prev =>
      prev.map((fila, idx) => {
        if (idx !== i) return fila
        if ("incluir" in cambio) return { ...fila, incluir: cambio.incluir! }
        if ("categoria" in cambio) {
          return { ...fila, analizado: { ...fila.analizado, categoria: cambio.categoria } }
        }
        // Tasa tecleada a mano. Se recalculan el importe base y los posibles
        // duplicados, que dependen de él: hasta tener importe en euros no se
        // puede comparar contra los gastos anotados a mano.
        const tasaManual = (cambio as { tasaManual: number | null }).tasaManual
        const m = fila.analizado.movimiento
        const tasa: TasaAplicada | null =
          tasaManual && tasaManual > 0 ? { rate: tasaManual, rateDate: m.date } : null
        const importeBase = tasa ? redondearImporte(m.amount * tasa.rate) : null
        return {
          ...fila,
          analizado: {
            ...fila.analizado,
            tasa,
            importeBase,
            posiblesDuplicados: buscarPosiblesDuplicados(m, importeBase, existentes),
          },
        }
      })
    )
  }

  // ---------- paso 2: confirmar ----------
  const sinTasa = filas.filter(f => f.analizado.tasa === null).length

  const importar = async () => {
    if (!puedeImportar || !supabase || sinTasa > 0) return
    setFase("importando")
    setError(null)

    try {
      const aInsertar = filas.map(f => construirFila(f.analizado, userId, generateUUID, f.incluir))
      const res = await insertarFilas(supabase as unknown as ClienteInsercion, aInsertar)
      setResultado(res)
      setFase("hecho")
      await onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : "La importación falló.")
      setFase("revision")
    }
  }

  // ---------- render ----------
  if (!puedeImportar) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importar extracto de tarjeta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            La importación de extractos necesita una cuenta: los movimientos se guardan
            sincronizados para que reimportar el mismo archivo no los duplique. Crea una
            cuenta desde Configuración y vuelve aquí.
          </p>
        </CardContent>
      </Card>
    )
  }

  const incluidos = filas.filter(f => f.incluir).length
  const conDuplicados = filas.filter(f => f.analizado.posiblesDuplicados.length > 0).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Importar extracto de tarjeta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {(fase === "inicio" || fase === "analizando") && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sube el CSV de tu extracto. Verás una previsualización antes de guardar nada:
                qué movimientos son nuevos, cuáles ya estaban y cuáles se parecen a gastos que
                anotaste a mano. Reimportar el mismo archivo no duplica.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  // Permite volver a elegir el mismo archivo tras un error.
                  e.target.value = ""
                  if (file) void analizarArchivo(file)
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={fase === "analizando"}>
                {fase === "analizando" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analizando extracto…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Elegir archivo CSV
                  </>
                )}
              </Button>
            </div>
          )}

          {(fase === "revision" || fase === "importando") && parse && (
            <div className="space-y-4">
              {/* Resumen del análisis. Los contadores raros (colapsos, filas
                  descartadas) se muestran siempre que no sean cero: son la
                  única señal de que el extracto trae algo inesperado. */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                  {filas.length} nuevos
                </span>
                {yaImportados > 0 && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {yaImportados} ya importados
                  </span>
                )}
                {descartadosAntes > 0 && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {descartadosAntes} descartados en importaciones anteriores
                  </span>
                )}
                {parse.credits.length > 0 && (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {parse.credits.length} abonos ignorados
                  </span>
                )}
                {parse.excluded.length > 0 && (
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                    {parse.excluded.length} filas ilegibles (líneas{" "}
                    {parse.excluded.map(x => x.line).join(", ")})
                  </span>
                )}
                {parse.duplicatesInFile > 0 && (
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                    {parse.duplicatesInFile} colapsados por identificador repetido en el archivo
                  </span>
                )}
                {parse.missingLast4 > 0 && (
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                    {parse.missingLast4} sin número de tarjeta
                  </span>
                )}
              </div>

              {conDuplicados > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {conDuplicados === 1
                      ? "1 movimiento se parece a un gasto que ya anotaste a mano"
                      : `${conDuplicados} movimientos se parecen a gastos que ya anotaste a mano`}{" "}
                    (mismo importe con ±3 días). Revísalos: si ya los tenías, desmárcalos para no
                    contarlos dos veces.
                  </span>
                </div>
              )}

              {sinTasa > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    {sinTasa === 1 ? "1 movimiento necesita" : `${sinTasa} movimientos necesitan`}{" "}
                    tipo de cambio: no hay tasa publicada para su divisa y fecha. Escríbelo en la
                    columna "Tasa" para poder importar.
                  </span>
                </div>
              )}

              {filas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay movimientos nuevos que importar: todo lo que trae el extracto ya está en
                  tus gastos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Comercio</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                        <TableHead className="text-right">Tasa</TableHead>
                        <TableHead className="text-right">En {DEFAULT_TARGET_CURRENCY}</TableHead>
                        <TableHead>Categoría</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filas.map((fila, i) => {
                        const m = fila.analizado.movimiento
                        const esDivisaBase = m.currency === DEFAULT_TARGET_CURRENCY
                        const dup = fila.analizado.posiblesDuplicados
                        return (
                          <TableRow key={m.externalId} className={fila.incluir ? "" : "opacity-50"}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-primary"
                                checked={fila.incluir}
                                onChange={e => cambiarFila(i, { incluir: e.target.checked })}
                                aria-label="Incluir movimiento"
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{m.date}</TableCell>
                            <TableCell className="text-sm">
                              <div>{m.merchant || m.description || "—"}</div>
                              {m.cardLast4 && (
                                <div className="text-xs text-muted-foreground">•••• {m.cardLast4}</div>
                              )}
                              {dup.length > 0 && (
                                <div className="text-xs text-amber-700 mt-1">
                                  ⚠ Parecido a: {dup.map(g => `${g.note || g.category} (${g.date})`).join("; ")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-sm">
                              {esDivisaBase
                                ? formatCurrency(m.amount)
                                : `${m.amount.toLocaleString("es-ES", { maximumFractionDigits: 4 })} ${m.currency}`}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-sm">
                              {esDivisaBase ? (
                                "—"
                              ) : fila.analizado.tasa ? (
                                <span title={`Tasa del ${fila.analizado.tasa.rateDate}`}>
                                  {fila.analizado.tasa.rate.toLocaleString("es-ES", { maximumFractionDigits: 6 })}
                                </span>
                              ) : (
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="Tasa"
                                  className="w-24 h-8 text-right inline-block"
                                  onChange={e =>
                                    cambiarFila(i, { tasaManual: Number.parseFloat(e.target.value) || null })
                                  }
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-sm font-medium">
                              {fila.analizado.importeBase !== null
                                ? formatCurrency(fila.analizado.importeBase)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={fila.analizado.categoria ?? "Otros"}
                                onValueChange={v => cambiarFila(i, { categoria: v })}
                              >
                                <SelectTrigger className="w-36 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {/* 'Otros' siempre está: es el valor al que cae
                                      la fila si la sugerencia no encontró nada. */}
                                  {Array.from(new Set([...categories, "Otros"])).map(cat => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                {filas.length > 0 && (
                  <Button onClick={() => void importar()} disabled={fase === "importando" || sinTasa > 0}>
                    {fase === "importando" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando…
                      </>
                    ) : (
                      `Importar ${incluidos} ${incluidos === 1 ? "movimiento" : "movimientos"}`
                    )}
                  </Button>
                )}
                <Button variant="outline" onClick={reiniciar} disabled={fase === "importando"}>
                  Cancelar
                </Button>
                {filas.length > 0 && incluidos < filas.length && (
                  <span className="text-xs text-muted-foreground">
                    Los desmarcados no contarán en tus gastos y no volverán a ofrecerse.
                  </span>
                )}
              </div>
            </div>
          )}

          {fase === "hecho" && resultado && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Importación completada: {incluidos}{" "}
                  {incluidos === 1 ? "movimiento añadido" : "movimientos añadidos"} a tus gastos
                  {filas.length - incluidos > 0 &&
                    `, ${filas.length - incluidos} descartados (no volverán a ofrecerse)`}
                  .
                </span>
              </div>
              {/* Backstop observable: si la red de integridad omitió filas, la
                  previsualización falló un caso y hay que decirlo, no taparlo. */}
              {resultado.omitidasPorConflicto > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  {resultado.omitidasPorConflicto}{" "}
                  {resultado.omitidasPorConflicto === 1 ? "fila ya existía" : "filas ya existían"} y
                  no se duplicaron. El resultado es correcto, pero la previsualización los contó
                  como nuevos.
                </div>
              )}
              {resultado.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  La importación se interrumpió a mitad: entraron {resultado.insertadas} de{" "}
                  {resultado.solicitadas} filas ({resultado.error}). Vuelve a importar el mismo
                  archivo: lo ya insertado no se duplicará.
                </div>
              )}
              <Button variant="outline" onClick={reiniciar}>
                Importar otro extracto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
