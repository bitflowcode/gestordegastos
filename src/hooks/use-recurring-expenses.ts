import { useState, useEffect } from "react"
import { generateUUID } from "@/lib/utils"

export interface RecurringExpense {
  id: string
  amount: number
  category: string
  day: number // Día del mes (1-31)
  note?: string
}

const STORAGE_KEY = "recurring-expenses-data"

export function useRecurringExpenses() {
  const [recurrings, setRecurrings] = useState<RecurringExpense[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setRecurrings(JSON.parse(stored))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recurrings))
  }, [recurrings])

  const addRecurring = (rec: Omit<RecurringExpense, "id">) => {
    setRecurrings(prev => [...prev, { ...rec, id: generateUUID() }])
  }

  const updateRecurring = (id: string, rec: Partial<RecurringExpense>) => {
    setRecurrings(prev => prev.map(r => r.id === id ? { ...r, ...rec } : r))
  }

  const deleteRecurring = (id: string) => {
    setRecurrings(prev => prev.filter(r => r.id !== id))
  }

  return {
    recurrings,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  }
} 