import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateUUID } from '@/lib/utils'

// Interfaz para los datos que enviará n8n
interface N8nExpenseData {
  amount: number
  category?: string
  date?: string
  note?: string
  merchant?: string
  confidence?: number
  source: 'email' | 'folder' | 'manual'
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
    
    // Determinar categoría inteligentemente si no viene
    const category = data.category || await suggestCategory(data.merchant, data.note)
    
    // Crear el gasto en Supabase
    const newExpense = {
      id: generateUUID(),
      user_id: data.userId,
      amount: data.amount,
      category: category,
      date: expenseDate,
      note: buildNote(data),
      is_recurring: false,
      created_at: new Date().toISOString(),
      // Metadatos adicionales para tracking
      metadata: {
        source: data.source,
        confidence: data.confidence,
        processed_by: 'n8n',
        original_data: data.originalData
      }
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' }, 
        { status: 500 }
      )
    }

    const { data: insertedExpense, error } = await supabase
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

// Función para sugerir categoría basada en merchant/nota
async function suggestCategory(merchant?: string, note?: string): Promise<string> {
  const text = `${merchant || ''} ${note || ''}`.toLowerCase()
  
  const categories = {
    'Alimentación': ['supermercado', 'mercado', 'carrefour', 'mercadona', 'comida'],
    'Transporte': ['gasolina', 'combustible', 'taxi', 'uber', 'metro', 'bus'],
    'Salud': ['farmacia', 'medicina', 'hospital', 'médico'],
    'Entretenimiento': ['cine', 'netflix', 'spotify', 'gaming'],
    'Hogar': ['ikea', 'ferretería', 'electricidad', 'agua', 'gas'],
    'Educación': ['curso', 'libro', 'universidad', 'formación']
  }
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category
    }
  }
  
  return 'Otros'
}

// Función para construir nota descriptiva
function buildNote(data: N8nExpenseData): string {
  let note = data.note || ''
  
  // Agregar información del merchant si existe
  if (data.merchant && !note.includes(data.merchant)) {
    note = `${data.merchant}${note ? ' - ' + note : ''}`
  }
  
  // Agregar indicador de origen automático
  const sourceIndicators = {
    'email': '📧 Auto-importado desde email',
    'folder': '📁 Auto-importado desde carpeta',
    'manual': '🤖 Procesado automáticamente'
  }
  
  note += ` (${sourceIndicators[data.source]})`
  
  return note
}

// GET para verificar que el endpoint funciona
export async function GET() {
  return NextResponse.json({
    message: 'n8n webhook endpoint is working',
    timestamp: new Date().toISOString()
  })
} 