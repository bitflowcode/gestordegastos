"use client"

import { useState, useEffect } from "react"
import { generateUUID } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export interface Expense {
  id: string
  amount: number
  category: string
  date: string
  note?: string
  isRecurring?: boolean
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

  const isGuest = !user

  // Cargar datos al inicializar
  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setIsLoading(true)
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
    if (!user) return

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

      // Mapear datos de Supabase al formato local
      const mappedExpenses = expensesData?.map(expense => ({
        id: expense.id,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        note: expense.note || "",
        isRecurring: expense.is_recurring || false,
      })) || []

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
    if (!user) return

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
    } else {
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
    } else {
      // Modo autenticado: eliminar de Supabase
      const { error } = await supabase
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
    } else {
      // Modo autenticado: actualizar en Supabase
      const { error } = await supabase
        .from('user_expenses')
        .update({
          amount: updatedExpense.amount,
          category: updatedExpense.category,
          date: updatedExpense.date,
          note: updatedExpense.note || null,
          is_recurring: updatedExpense.isRecurring || false,
        })
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
    } else {
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
    } else {
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