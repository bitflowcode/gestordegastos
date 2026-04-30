import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.rpc('disconnect_gmail', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error disconnecting Gmail:', error)
      return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Gmail desconectado' })
  } catch (err) {
    console.error('Disconnect error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
