import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('get_gmail_connection_status', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Error getting Gmail status:', error)
    return NextResponse.json({ connected: false })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ connected: false })
  }

  const conn = data[0]
  return NextResponse.json({
    connected: true,
    email: conn.gmail_email,
    labelName: conn.gmail_label_name,
    lastProcessedAt: conn.last_processed_at,
    lastError: conn.last_error,
    isActive: conn.is_active,
  })
}
