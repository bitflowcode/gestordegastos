"use client"

// ============================================================
// use-card-budget.ts
// Presupuestos por tarjeta y mes (tabla card_budgets).
//
// La herencia del mes anterior se resuelve AQUÍ, en lectura, no escribiendo
// filas: si noviembre no tiene presupuesto propio, rige el más reciente de los
// meses anteriores, marcado como heredado. Solo se escribe una fila cuando el
// usuario edita el importe de un mes concreto. Así un presupuesto "fijo" (51 €
// hasta que lo cambies) no necesita una fila por mes, y cambiarlo en diciembre
// no reescribe la historia de octubre.
// ============================================================

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { generateUUID } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

export interface CardBudgetRow {
  id: string
  cardLast4: string
  month: string // 'YYYY-MM'
  amount: number
  alertThreshold: number | null
}

/** Presupuesto vigente para una tarjeta y mes, con su procedencia. */
export interface PresupuestoVigente {
  amount: number
  alertThreshold: number | null
  /** true si no hay fila para ese mes y rige la del último mes anterior. */
  heredado: boolean
  /** Mes del que procede el importe ('YYYY-MM'). */
  deMes: string
}

export function useCardBudget(user: User | null) {
  const [budgets, setBudgets] = useState<CardBudgetRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Mismo criterio que use-expenses-hybrid: recargar por cambio de
    // IDENTIDAD, no por cada objeto `user` nuevo que entregue un refresco
    // de token.
    if (prevUserIdRef.current === (user?.id ?? null)) return
    prevUserIdRef.current = user?.id ?? null

    if (!user || !supabase) {
      setBudgets([])
      setIsLoading(false)
      return
    }

    const cargar = async () => {
      setIsLoading(true)
      try {
        // La tabla completa del usuario: una fila por tarjeta y mes editado.
        // Crece a lo sumo unas filas al año; no necesita ventana ni paginado.
        const { data, error } = await supabase!
          .from("card_budgets")
          .select("id,card_last4,month,amount,alert_threshold")
          .eq("user_id", user.id)

        if (error) throw error
        setBudgets(
          (data || []).map(r => ({
            id: r.id,
            cardLast4: r.card_last4,
            month: r.month,
            amount: Number(r.amount),
            alertThreshold: r.alert_threshold === null ? null : Number(r.alert_threshold),
          }))
        )
      } catch (error) {
        console.error("Error cargando los presupuestos de tarjeta:", error)
      } finally {
        setIsLoading(false)
      }
    }
    void cargar()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Presupuesto vigente para una tarjeta y mes. null = nunca se ha definido
   * ninguno para esa tarjeta (ni ese mes ni anteriores): la vista debe invitar
   * a crearlo, no enseñar un 0 que parecería un presupuesto agotado.
   *
   * Los meses FUTUROS al consultado no cuentan: definir diciembre no cambia
   * lo que regía en noviembre.
   */
  const presupuestoVigente = (cardLast4: string, month: string): PresupuestoVigente | null => {
    const deTarjeta = budgets.filter(b => b.cardLast4 === cardLast4)
    const exacto = deTarjeta.find(b => b.month === month)
    if (exacto) {
      return { amount: exacto.amount, alertThreshold: exacto.alertThreshold, heredado: false, deMes: exacto.month }
    }
    // 'YYYY-MM' ordena bien como cadena.
    const anteriores = deTarjeta.filter(b => b.month < month).sort((a, b) => b.month.localeCompare(a.month))
    if (anteriores.length === 0) return null
    const ultimo = anteriores[0]
    return { amount: ultimo.amount, alertThreshold: ultimo.alertThreshold, heredado: true, deMes: ultimo.month }
  }

  /**
   * Fija el presupuesto de una tarjeta para UN mes. Materializa la fila aunque
   * el importe coincida con el heredado: a partir de ahí ese mes tiene valor
   * propio y deja de moverse si se cambia el anterior.
   */
  const guardarPresupuesto = async (
    cardLast4: string,
    month: string,
    amount: number
  ): Promise<boolean> => {
    if (!user || !supabase) return false

    const existente = budgets.find(b => b.cardLast4 === cardLast4 && b.month === month)
    const id = existente?.id ?? generateUUID()

    const { error } = await supabase
      .from("card_budgets")
      .upsert(
        {
          id,
          user_id: user.id,
          card_last4: cardLast4,
          month,
          amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,card_last4,month" }
      )

    if (error) {
      console.error("Error guardando el presupuesto:", error)
      return false
    }

    setBudgets(prev => {
      const sin = prev.filter(b => !(b.cardLast4 === cardLast4 && b.month === month))
      return [...sin, { id, cardLast4, month, amount, alertThreshold: existente?.alertThreshold ?? null }]
    })
    return true
  }

  /** Tarjetas con algún presupuesto definido (para unir con las del extracto). */
  const tarjetasConPresupuesto = Array.from(new Set(budgets.map(b => b.cardLast4)))

  return { budgets, isLoading, presupuestoVigente, guardarPresupuesto, tarjetasConPresupuesto }
}
