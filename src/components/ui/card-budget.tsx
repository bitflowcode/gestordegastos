"use client"

// ============================================================
// card-budget.tsx
// Vista de día y presupuesto por tarjeta, dentro de la pestaña "Tarjetas".
//
// Dos reglas que vienen del diseño y no deben relajarse:
//
//   * Un mes cuyos gastos no están cargados se muestra como NO DISPONIBLE
//     (con botón para cargarlo), nunca como cero: un 0,00 € creíble y falso
//     es peor que no poder consultar. Es el mismo mecanismo de Inicio y el
//     Historial, heredado, no reinventado.
//   * "Gastado" se calcula sobre los gastos en memoria, que ya vienen sin los
//     'card_import_excluded'. Cuentan tanto los importados como los manuales
//     imputados a la tarjeta.
// ============================================================

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AlertTriangle, ChevronLeft, ChevronRight, CreditCard, Loader2, Pencil } from "lucide-react"
import { formatCurrency, formatDateToString, formatMonthLabel } from "@/lib/utils"
import { useCardBudget } from "@/hooks/use-card-budget"
import type { Expense } from "@/hooks/use-expenses-hybrid"
import type { User } from "@supabase/supabase-js"

interface CardBudgetProps {
  user: User | null
  expenses: Expense[]
  availableMonths: string[]
  isMonthLoaded: (month: string) => boolean
  loadMonth: (month: string) => Promise<void>
  loadingMonth: string | null
}

export function CardBudgetView({
  user,
  expenses,
  availableMonths,
  isMonthLoaded,
  loadMonth,
  loadingMonth,
}: CardBudgetProps) {
  const { presupuestoVigente, guardarPresupuesto, tarjetasConPresupuesto, isLoading } =
    useCardBudget(user)

  const hoy = formatDateToString(new Date())
  const mesActual = hoy.slice(0, 7)
  const [mes, setMes] = useState(mesActual)
  // Tarjeta en edición y el texto tecleado ("" = ninguna editándose).
  const [editando, setEditando] = useState<string | null>(null)
  const [importeEditado, setImporteEditado] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Misma unión que Inicio: meses con gastos (cargados o no) más el actual.
  const meses = useMemo(
    () =>
      Array.from(
        new Set(
          availableMonths.concat(expenses.map(e => e.date.slice(0, 7))).concat([mesActual])
        )
      ).sort(),
    [availableMonths, expenses, mesActual]
  )
  const indice = meses.indexOf(mes)

  // Tarjetas conocidas: las vistas en los gastos cargados más las que tienen
  // presupuesto. La unión importa: una tarjeta sin movimientos este mes pero
  // con presupuesto definido debe seguir apareciendo.
  const tarjetas = useMemo(() => {
    const deGastos = expenses
      .map(e => e.cardLast4)
      .filter((l): l is string => !!l)
    return Array.from(new Set(deGastos.concat(tarjetasConPresupuesto))).sort()
  }, [expenses, tarjetasConPresupuesto])

  // Gastado por tarjeta en el mes seleccionado, y hoy. Un solo recorrido.
  const gastadoPorTarjeta = useMemo(() => {
    const porMes = new Map<string, number>()
    const porHoy = new Map<string, number>()
    for (const e of expenses) {
      if (!e.cardLast4) continue
      if (e.date.startsWith(mes)) {
        porMes.set(e.cardLast4, (porMes.get(e.cardLast4) || 0) + e.amount)
      }
      if (e.date === hoy) {
        porHoy.set(e.cardLast4, (porHoy.get(e.cardLast4) || 0) + e.amount)
      }
    }
    return { porMes, porHoy }
  }, [expenses, mes, hoy])

  const irAlMes = (m: string) => {
    setMes(m)
    setEditando(null)
    if (!isMonthLoaded(m)) void loadMonth(m)
  }

  const guardar = async (last4: string) => {
    const valor = Number.parseFloat(importeEditado.replace(",", "."))
    if (!Number.isFinite(valor) || valor < 0) return
    setGuardando(true)
    const ok = await guardarPresupuesto(last4, mes, Math.round(valor * 100) / 100)
    setGuardando(false)
    if (ok) {
      setEditando(null)
      setImporteEditado("")
    }
  }

  if (!user) return null // el aviso de cuenta ya lo da el importador, debajo

  const mesCargado = isMonthLoaded(mes)
  const cargandoMes = loadingMonth === mes

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Presupuesto por tarjeta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selector de mes, con las mismas flechas que Inicio */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => indice > 0 && irAlMes(meses[indice - 1])}
            disabled={indice <= 0}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-36 text-center capitalize">
            {formatMonthLabel(mes)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => indice < meses.length - 1 && irAlMes(meses[indice + 1])}
            disabled={indice >= meses.length - 1}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {tarjetas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay ninguna tarjeta: importa un extracto (debajo) y aparecerán aquí sus
            tarjetas, con su gasto del día y su presupuesto mensual.
          </p>
        ) : !mesCargado ? (
          // Mes fuera de la ventana y sin cargar: nunca enseñar un cero falso.
          <div className="text-center py-6 text-sm text-muted-foreground">
            {cargandoMes ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando los gastos de {formatMonthLabel(mes)}…
              </span>
            ) : (
              <>
                <p className="mb-2">Los gastos de este mes no están cargados.</p>
                <Button variant="outline" size="sm" onClick={() => void loadMonth(mes)}>
                  Cargar {formatMonthLabel(mes)}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tarjetas.map(last4 => {
              const gastado = gastadoPorTarjeta.porMes.get(last4) || 0
              const gastadoHoy = gastadoPorTarjeta.porHoy.get(last4) || 0
              const vigente = presupuestoVigente(last4, mes)
              const enEdicion = editando === last4

              // Umbral de aviso sobre el RESTANTE: el definido o, por defecto,
              // el 10% del presupuesto (alert_threshold NULL en el esquema).
              const restante = vigente ? vigente.amount - gastado : null
              const umbral = vigente
                ? (vigente.alertThreshold ?? vigente.amount * 0.1)
                : null
              const pasado = restante !== null && restante < 0
              const alAviso = !pasado && restante !== null && umbral !== null && restante <= umbral
              const proporcion = vigente && vigente.amount > 0 ? Math.min(gastado / vigente.amount, 1) : 0

              return (
                <div key={last4} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">•••• {last4}</span>
                    {mes === mesActual && (
                      <span className="text-sm text-muted-foreground">
                        Hoy: <span className="font-medium text-foreground">{formatCurrency(gastadoHoy)}</span>
                      </span>
                    )}
                  </div>

                  {enEdicion ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={importeEditado}
                        onChange={e => setImporteEditado(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && void guardar(last4)}
                        placeholder="Presupuesto del mes"
                        className="h-9"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => void guardar(last4)} disabled={guardando}>
                        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditando(null)} disabled={guardando}>
                        Cancelar
                      </Button>
                    </div>
                  ) : vigente === null ? (
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">Sin presupuesto definido.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditando(last4)
                          setImporteEditado("")
                        }}
                        disabled={isLoading}
                      >
                        Definir presupuesto
                      </Button>
                      <p className="mt-2">
                        Gastado este mes: <span className="font-medium text-foreground">{formatCurrency(gastado)}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Presupuesto: <span className="font-medium text-foreground">{formatCurrency(vigente.amount)}</span>
                          {vigente.heredado && (
                            <span
                              className="ml-1 text-xs"
                              title={`Sin importe propio este mes: rige el de ${formatMonthLabel(vigente.deMes)}. Al editarlo, este mes tendrá el suyo.`}
                            >
                              (de {formatMonthLabel(vigente.deMes)})
                            </span>
                          )}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label="Editar presupuesto"
                          onClick={() => {
                            setEditando(last4)
                            setImporteEditado(String(vigente.amount))
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pasado ? "bg-red-500" : alAviso ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${proporcion * 100}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Gastado: <span className="font-medium text-foreground">{formatCurrency(gastado)}</span>
                        </span>
                        <span className={pasado ? "text-red-600 font-medium" : alAviso ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                          {pasado
                            ? `Pasado en ${formatCurrency(-restante!)}`
                            : `Restante: ${formatCurrency(restante!)}`}
                        </span>
                      </div>

                      {(pasado || alAviso) && (
                        <p className="text-xs flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {pasado
                            ? "Presupuesto superado este mes."
                            : "Queda poco presupuesto este mes."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
