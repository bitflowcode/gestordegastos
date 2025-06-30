"use client"

import { createContext, useContext } from 'react'
import { useAuthProvider } from '@/hooks/use-auth'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
} 