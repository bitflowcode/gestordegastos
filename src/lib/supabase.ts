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

/**
 * Origen de un gasto. Coincide con el CHECK de user_expenses.source.
 *
 * 'card_import_excluded' es un movimiento de extracto que el usuario descartó:
 * la fila NO se borra, para que conserve su external_id y la deduplicación la
 * omita en la siguiente importación. El hook la filtra al cargar, así que no
 * cuenta en totales, gráficos ni presupuesto.
 */
export type ExpenseSource = 'manual' | 'card_import' | 'card_import_excluded'

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
          receipt_url: string | null
          confidence_score: number | null
          // Módulo "Tarjetas"
          source: ExpenseSource
          external_id: string | null
          card_last4: string | null
          merchant: string | null
          currency: string | null
          original_amount: number | null
          exchange_rate: number | null
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
          receipt_url?: string | null
          confidence_score?: number | null
          source?: ExpenseSource
          external_id?: string | null
          card_last4?: string | null
          merchant?: string | null
          currency?: string | null
          original_amount?: number | null
          exchange_rate?: number | null
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
          receipt_url?: string | null
          confidence_score?: number | null
          source?: ExpenseSource
          external_id?: string | null
          card_last4?: string | null
          merchant?: string | null
          currency?: string | null
          original_amount?: number | null
          exchange_rate?: number | null
        }
      }
      card_budgets: {
        Row: {
          id: string
          user_id: string
          card_last4: string
          month: string
          amount: number
          alert_threshold: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_last4: string
          month: string
          amount?: number
          alert_threshold?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_last4?: string
          month?: string
          amount?: number
          alert_threshold?: number | null
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