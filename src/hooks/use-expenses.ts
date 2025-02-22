"use client"

import { useState, useEffect } from "react"

export interface Expense {
  id: string // Cambiado de number a string
  amount: number
  category: string
  date: string
  note?: string
}

const STORAGE_KEY = "expenses-data"
const CATEGORIES_KEY = "expense-categories"

const DEFAULT_CATEGORIES = ["Alimentación", "Transporte", "Vivienda", "Entretenimiento", "Salud", "Educación", "Otros"]

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)

  // Load expenses and categories from localStorage on mount
  useEffect(() => {
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
      console.error("Error loading data from localStorage:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save expenses and categories to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
      } catch (error) {
        console.error("Error saving data to localStorage:", error)
      }
    }
  }, [expenses, categories, isLoading])

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = {
      ...expense,
      id: crypto.randomUUID(), // Usando UUID en lugar de Date.now()
    }
    setExpenses((prevExpenses) => [...prevExpenses, newExpense])
  }

  const deleteExpense = (id: string) => {
    // Actualizado a string
    setExpenses((prevExpenses) => prevExpenses.filter((expense) => expense.id !== id))
  }

  const updateExpense = (id: string, updatedExpense: Partial<Expense>) => {
    // Actualizado a string
    setExpenses((prevExpenses) =>
      prevExpenses.map((expense) => (expense.id === id ? { ...expense, ...updatedExpense } : expense)),
    )
  }

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

  const addCategory = (category: string) => {
    setCategories((prevCategories) => [...prevCategories, category])
  }

  const removeCategory = (category: string) => {
    setCategories((prevCategories) => prevCategories.filter((c) => c !== category))
  }

  return {
    expenses,
    categories,
    isLoading,
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

