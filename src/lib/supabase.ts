import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Verificar si las variables de entorno están disponibles
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey

// Crear cliente de Supabase solo si las variables están disponibles
// Durante el build o si no hay configuración, usar un cliente dummy
export const supabase = hasSupabaseConfig 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

// Helper para verificar si Supabase está disponible
export const isSupabaseConfigured = (): boolean => !!hasSupabaseConfig

// Tipos para TypeScript
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: string
          date: string
          note: string | null
          is_recurring: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category: string
          date: string
          note?: string | null
          is_recurring?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: string
          date?: string
          note?: string | null
          is_recurring?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      user_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      user_recurring_expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: string
          day_of_month: number
          note: string | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category: string
          day_of_month: number
          note?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: string
          day_of_month?: number
          note?: string | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 