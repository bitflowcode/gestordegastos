"use client"

import { useState, useEffect, useRef } from "react"
import { generateUUID } from "@/lib/utils"
import { supabase, isSupabaseConfigured, type ExpenseSource } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export interface Expense {
  id: string
  amount: number
  category: string
  date: string
  note?: string
  isRecurring?: boolean

  // --- Módulo "Tarjetas" ---
  // Opcionales: un gasto manual no los lleva. `amount` sigue siendo siempre el
  // importe en la divisa base; originalAmount/currency/exchangeRate conservan
  // el dato de origen para que la conversión sea auditable y recalculable.
  source?: ExpenseSource
  externalId?: string | null
  cardLast4?: string | null
  merchant?: string | null
  currency?: string | null
  originalAmount?: number | null
  exchangeRate?: number | null
}

const STORAGE_KEY = "expenses-data"
const CATEGORIES_KEY = "expense-categories"
const MIGRATION_KEY = "data-migrated"

const DEFAULT_CATEGORIES = ["Alimentación", "Transporte", "Vivienda", "Entretenimiento", "Salud", "Educación", "Otros"]

export function useExpensesHybrid(user: User | null) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Rastrea el userId previo para distinguir carga inicial de refrescos de token
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  const isGuest = !user

  // Cargar datos al inicializar o cuando cambia la identidad del usuario
  useEffect(() => {
    const isFirstLoad = prevUserIdRef.current === undefined
    const userIdChanged = prevUserIdRef.current !== (user?.id ?? null)
    prevUserIdRef.current = user?.id ?? null

    // Solo mostrar pantalla de carga en la primera carga o si el usuario cambia.
    // Si es un refresco de token (mismo userId), sincronizar en segundo plano.
    loadData(isFirstLoad || userIdChanged)
  }, [user])

  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true)
    try {
      if (isGuest) {
        // Modo guest: usar localStorage
        await loadFromLocalStorage()
      } else {
        // Modo autenticado: usar Supabase
        await loadFromSupabase()
        // Migrar datos de localStorage si es la primera vez
        await migrateLocalDataIfNeeded()
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFromLocalStorage = async () => {
    try {
      const storedExpenses = localStorage.getItem(STORAGE_KEY)
      if (storedExpenses) {
        setExpenses(JSON.parse(storedExpenses))
      }

      const storedCategories = localStorage.getItem(CATEGORIES_KEY)
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories))
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error)
    }
  }

  const loadFromSupabase = async () => {
    if (!user || !supabase) return

    try {
      // Cargar gastos
      const { data: expensesData, error: expensesError } = await supabase
        .from('user_expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (expensesError) throw expensesError

      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('user_categories')
        .select('name')
        .eq('user_id', user.id)

      if (categoriesError) throw categoriesError

      // Mapear datos de Supabase al formato local.
      //
      // El filtro de 'card_import_excluded' vive AQUÍ, en la carga, y no debe
      // confundirse con la consulta de deduplicación del importador, que es la
      // opuesta: aquella SÍ tiene que devolver los excluidos (acotada por el
      // rango de fechas del extracto), porque su external_id es justo lo que
      // impide que un movimiento descartado reaparezca al reimportar.
      // Son dos lecturas de la misma tabla con propósitos contrarios.
      const mappedExpenses = (expensesData || [])
        .filter(expense => expense.source !== 'card_import_excluded')
        .map(expense => ({
          id: expense.id,
          amount: expense.amount,
          category: expense.category,
          date: expense.date,
          note: expense.note || "",
          isRecurring: expense.is_recurring || false,
          source: (expense.source ?? 'manual') as ExpenseSource,
          externalId: expense.external_id ?? null,
          cardLast4: expense.card_last4 ?? null,
          merchant: expense.merchant ?? null,
          currency: expense.currency ?? null,
          originalAmount: expense.original_amount ?? null,
          exchangeRate: expense.exchange_rate ?? null,
        }))

      const mappedCategories = categoriesData?.map(cat => cat.name) || DEFAULT_CATEGORIES

      setExpenses(mappedExpenses)
      setCategories(mappedCategories)
    } catch (error) {
      console.error("Error loading from Supabase:", error)
      // Fallback a localStorage si hay error
      await loadFromLocalStorage()
    }
  }

  const migrateLocalDataIfNeeded = async () => {
    if (!user || !supabase) return

    // Verificar si ya se migró
    const migrated = localStorage.getItem(MIGRATION_KEY)
    if (migrated) return

    setIsSyncing(true)
    try {
      // Obtener datos de localStorage
      const localExpenses = localStorage.getItem(STORAGE_KEY)
      const localCategories = localStorage.getItem(CATEGORIES_KEY)

      if (localExpenses) {
        const expenses = JSON.parse(localExpenses)
        if (expenses.length > 0) {
          console.log(`Migrando ${expenses.length} gastos a la nube...`)
          
          // Subir gastos a Supabase
          const { error: expensesError } = await supabase
            .from('user_expenses')
            .insert(
              expenses.map((expense: Expense) => ({
                id: expense.id,
                user_id: user.id,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
                note: expense.note || null,
                is_recurring: expense.isRecurring || false,
              }))
            )

          if (expensesError) throw expensesError
        }
      }

      if (localCategories) {
        const categories = JSON.parse(localCategories)
        // Solo migrar categorías que no estén ya en la base de datos
        const { data: existingCategories } = await supabase
          .from('user_categories')
          .select('name')
          .eq('user_id', user.id)

        const existingNames = existingCategories?.map(cat => cat.name) || []
        const newCategories = categories.filter((cat: string) => 
          !existingNames.includes(cat) && !DEFAULT_CATEGORIES.includes(cat)
        )

        if (newCategories.length > 0) {
          const { error: categoriesError } = await supabase
            .from('user_categories')
            .insert(
              newCategories.map((name: string) => ({
                user_id: user.id,
                name,
              }))
            )

          if (categoriesError) throw categoriesError
        }
      }

      // Marcar como migrado
      localStorage.setItem(MIGRATION_KEY, 'true')
      console.log("✅ Migración completada exitosamente")
      
      // Recargar datos desde Supabase
      await loadFromSupabase()
    } catch (error) {
      console.error("Error en migración:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  const saveData = async () => {
    if (isGuest) {
      // Guardar en localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
    }
    // Si está autenticado, los datos ya se guardan en tiempo real via Supabase
  }

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const newExpense = {
      ...expense,
      id: generateUUID(),
    }

    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => [...prev, newExpense])
    } else if (supabase) {
      // Modo autenticado: insertar en Supabase
      const { error } = await supabase
        .from('user_expenses')
        .insert({
          id: newExpense.id,
          user_id: user!.id,
          amount: newExpense.amount,
          category: newExpense.category,
          date: newExpense.date,
          note: newExpense.note || null,
          is_recurring: newExpense.isRecurring || false,
        })

      if (error) {
        console.error("Error adding expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => [...prev, newExpense])
    }
  }

  const deleteExpense = async (id: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => prev.filter(expense => expense.id !== id))
    } else if (supabase) {
      // Un movimiento importado de un extracto NO se borra: se marca como
      // excluido. La fila conserva su external_id, y eso es justo lo que
      // impide que reaparezca en la siguiente importación (el extracto del mes
      // en curso se reimporta varias veces dentro del mismo mes). Al quedar
      // fuera del mapeo de carga, deja de contar en totales y presupuesto, y
      // sigue siendo recuperable.
      const esImportado = expenses.find(e => e.id === id)?.source === 'card_import'

      const { error } = esImportado
        ? await supabase
            .from('user_expenses')
            .update({ source: 'card_import_excluded' })
            .eq('id', id)
            .eq('user_id', user!.id)
        : await supabase
            .from('user_expenses')
            .delete()
            .eq('id', id)
            .eq('user_id', user!.id)

      if (error) {
        console.error("Error deleting expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => prev.filter(expense => expense.id !== id))
    }
  }

  const updateExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setExpenses(prev => 
        prev.map(expense => 
          expense.id === id ? { ...expense, ...updatedExpense } : expense
        )
      )
    } else if (supabase) {
      // Solo se envían los campos presentes. Construirlo como
      // `note: updatedExpense.note || null` borraba la nota en cualquier
      // actualización parcial, y lo mismo `is_recurring`.
      //
      // Los campos del módulo de tarjetas no se tocan nunca aquí: así,
      // recategorizar un movimiento importado desde el Historial no le borra el
      // external_id, que es la clave de la deduplicación.
      const payload: Record<string, unknown> = {}
      if (updatedExpense.amount !== undefined) payload.amount = updatedExpense.amount
      if (updatedExpense.category !== undefined) payload.category = updatedExpense.category
      if (updatedExpense.date !== undefined) payload.date = updatedExpense.date
      if (updatedExpense.note !== undefined) payload.note = updatedExpense.note || null
      if (updatedExpense.isRecurring !== undefined) payload.is_recurring = updatedExpense.isRecurring

      const { error } = await supabase
        .from('user_expenses')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user!.id)

      if (error) {
        console.error("Error updating expense:", error)
        return
      }

      // Actualizar estado local
      setExpenses(prev => 
        prev.map(expense => 
          expense.id === id ? { ...expense, ...updatedExpense } : expense
        )
      )
    }
  }

  const addCategory = async (category: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setCategories(prev => [...prev, category])
    } else if (supabase) {
      // Modo autenticado: insertar en Supabase
      const { error } = await supabase
        .from('user_categories')
        .insert({
          user_id: user!.id,
          name: category,
        })

      if (error) {
        console.error("Error adding category:", error)
        return
      }

      // Actualizar estado local
      setCategories(prev => [...prev, category])
    }
  }

  const removeCategory = async (category: string) => {
    if (isGuest) {
      // Modo guest: actualizar estado y localStorage
      setCategories(prev => prev.filter(c => c !== category))
    } else if (supabase) {
      // Modo autenticado: eliminar de Supabase
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('user_id', user!.id)
        .eq('name', category)

      if (error) {
        console.error("Error removing category:", error)
        return
      }

      // Actualizar estado local
      setCategories(prev => prev.filter(c => c !== category))
    }
  }

  // Guardar en localStorage cuando cambian los datos (solo en modo guest)
  useEffect(() => {
    if (!isLoading && isGuest) {
      saveData()
    }
  }, [expenses, categories, isLoading, isGuest])

  // Refresca los gastos desde Supabase sin mostrar pantalla de carga.
  // Lo necesita el importador de extractos: sin esto, los movimientos recién
  // insertados no aparecerían hasta recargar la página.
  const reload = async () => {
    await loadData(false)
  }

  // Funciones de utilidad (sin cambios)
  const getExpensesByMonth = (month: string) => {
    return expenses.filter((expense) => expense.date.startsWith(month))
  }

  const getTotalByMonth = (month: string) => {
    return getExpensesByMonth(month).reduce((sum, expense) => sum + expense.amount, 0)
  }

  const getExpensesByCategory = (month: string) => {
    const monthExpenses = getExpensesByMonth(month)
    return monthExpenses.reduce(
      (acc, expense) => {
        const existingCategory = acc.find((item) => item.name === expense.category)
        if (existingCategory) {
          existingCategory.value += expense.amount
        } else {
          acc.push({ name: expense.category, value: expense.amount })
        }
        return acc
      },
      [] as Array<{ name: string; value: number }>,
    )
  }

  return {
    expenses,
    categories,
    isLoading,
    isSyncing,
    isGuest,
    reload,
    addExpense,
    deleteExpense,
    updateExpense,
    getExpensesByMonth,
    getTotalByMonth,
    getExpensesByCategory,
    addCategory,
    removeCategory,
  }
} 