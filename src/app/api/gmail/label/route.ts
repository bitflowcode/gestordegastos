import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { userId, labelName } = await request.json()

    if (!userId || !labelName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.rpc('update_gmail_label', {
      p_user_id: userId,
      p_label_name: labelName,
    })

    if (error) {
      console.error('Error updating label:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Etiqueta actualizada' })
  } catch (err) {
    console.error('Label update error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
