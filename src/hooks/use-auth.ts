"use client"

import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  isGuest: boolean
  isLoading: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  shouldShowUpgradePrompt: () => boolean
  dismissUpgradePrompt: () => void
  canUpgrade: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isGuest = !user

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const shouldShowUpgradePrompt = () => {
    // No mostrar si ya está autenticado
    if (!isGuest) return false

    // No mostrar si ya fue descartado recientemente
    const dismissed = localStorage.getItem('upgrade-prompt-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (dismissedDate > weekAgo) return false
    }

    // Verificar condiciones para mostrar el prompt
    const expenses = JSON.parse(localStorage.getItem('expenses-data') || '[]')
    const firstUse = localStorage.getItem('first-use-date')
    
    if (!firstUse) {
      localStorage.setItem('first-use-date', new Date().toISOString())
      return false
    }

    const daysSinceFirstUse = (Date.now() - new Date(firstUse).getTime()) / (1000 * 60 * 60 * 24)
    
    // Mostrar después de 7 días Y más de 10 gastos
    return daysSinceFirstUse >= 7 && expenses.length >= 10
  }

  const dismissUpgradePrompt = () => {
    localStorage.setItem('upgrade-prompt-dismissed', new Date().toISOString())
  }

  const canUpgrade = () => {
    // Siempre permitir upgrade para usuarios guest
    return isGuest
  }

  return {
    user,
    isGuest,
    isLoading,
    signUp,
    signIn,
    signOut,
    shouldShowUpgradePrompt,
    dismissUpgradePrompt,
    canUpgrade,
  }
} 