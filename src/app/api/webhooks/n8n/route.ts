import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sugerirCategoria } from '@/lib/merchant-category'

// Crear cliente de Supabase con Service Role Key para bypasear RLS
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Interfaz para los datos que enviará n8n
interface N8nExpenseData {
  amount: number
  category?: string
  date?: string
  note?: string
  merchant?: string
  confidence?: number
  source?: string
  originalData?: any
  userId: string
  apiKey: string // Para autenticación
}

export async function POST(request: NextRequest) {
  try {
    const data: N8nExpenseData = await request.json()
    
    // Validar API key (puedes usar un hash del user ID + secret)
    const expectedApiKey = generateApiKey(data.userId)
    if (data.apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' }, 
        { status: 401 }
      )
    }

    // Validar datos mínimos
    if (!data.amount || data.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' }, 
        { status: 400 }
      )
    }

    // Procesar fecha (usar actual si no viene)
    const expenseDate = data.date || new Date().toISOString().slice(0, 10)
    
    const supabaseAdmin = getSupabaseAdmin()

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured. Missing SUPABASE_SERVICE_ROLE_KEY' }, 
        { status: 500 }
      )
    }

    // Determinar categoría si no viene. Se resuelve contra las categorías que el
    // usuario tiene de verdad: la tabla que había aquí asignaba 'Hogar', que no
    // existe en la aplicación, y como `category` es texto libre sin clave ajena,
    // esos gastos quedaban fuera de todos los filtros y de la leyenda del
    // gráfico. El cliente admin ya está resuelto arriba y se reutiliza.
    const category =
      data.category ||
      await sugerirCategoriaDelUsuario(supabaseAdmin, data)

    // Crear el gasto en Supabase
    const newExpense = {
      user_id: data.userId,
      amount: data.amount,
      category: category,
      date: expenseDate,
      note: buildNote(data),
      is_recurring: false
    }

    const { data: insertedExpense, error } = await supabaseAdmin
      .from('user_expenses')
      .insert(newExpense)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create expense' }, 
        { status: 500 }
      )
    }

    // Respuesta exitosa con datos del gasto creado
    return NextResponse.json({
      success: true,
      expense: {
        id: insertedExpense.id,
        amount: insertedExpense.amount,
        category: insertedExpense.category,
        date: insertedExpense.date,
        note: insertedExpense.note
      },
      message: 'Expense created successfully via n8n'
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// Función para generar API key del usuario
function generateApiKey(userId: string): string {
  const secret = process.env.N8N_WEBHOOK_SECRET || 'default-secret'
  return Buffer.from(`${userId}:${secret}`).toString('base64')
}

/**
 * Categoría sugerida para un gasto que llega por webhook, resuelta contra las
 * categorías del usuario. Si no se pueden leer, 'Otros': es preferible una
 * categoría visible y corregible a bloquear una automatización.
 */
async function sugerirCategoriaDelUsuario(
  supabaseAdmin: SupabaseClient,
  data: N8nExpenseData
): Promise<string> {
  const { data: filas, error } = await supabaseAdmin
    .from('user_categories')
    .select('name')
    .eq('user_id', data.userId)

  if (error) console.error('Error leyendo las categorías del usuario:', error)

  const categorias = (filas || []).map((c: { name: string }) => c.name)
  return sugerirCategoria(`${data.merchant || ''} ${data.note || ''}`, categorias) ?? 'Otros'
}

// Función para construir nota descriptiva
function buildNote(data: N8nExpenseData): string {
  let note = data.note || ''
  
  // Agregar información del merchant si existe
  if (data.merchant && !note.includes(data.merchant)) {
    note = `${data.merchant}${note ? ' - ' + note : ''}`
  }
  
  // Agregar indicador de origen automático
  const sourceIndicators: Record<string, string> = {
    'email': '📧 Auto-importado desde email',
    'folder': '📁 Auto-importado desde carpeta',
    'manual': '🤖 Procesado automáticamente',
    'n8n-test': '🧪 Prueba desde n8n'
  }
  
  const sourceLabel = sourceIndicators[data.source || 'manual'] || '🔄 Importado automáticamente'
  note += ` (${sourceLabel})`
  
  return note
}

// GET para verificar que el endpoint funciona
export async function GET() {
  return NextResponse.json({
    message: 'n8n webhook endpoint is working',
    timestamp: new Date().toISOString()
  })
} 