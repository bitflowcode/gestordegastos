import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { encrypt } from '@/lib/encryption'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const userId = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=' + error, request.url)
    )
  }

  if (!code || !userId) {
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=missing_params', request.url)
    )
  }

  try {
    // 1. Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Token exchange failed:', tokens)
      return NextResponse.redirect(
        new URL('/settings?gmail=error&reason=token_failed', request.url)
      )
    }

    // 2. Obtener el email del usuario de Gmail
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    )
    const profile = await profileResponse.json()
    const gmailEmail = profile.email

    // 3. Cifrar tokens
    const encryptedRefreshToken = encrypt(tokens.refresh_token)
    const encryptedAccessToken = encrypt(tokens.access_token)

    // 4. Guardar en Supabase (upsert por si ya existe una conexión)
    const { error: dbError } = await supabaseAdmin.rpc('upsert_gmail_connection', {
      p_user_id: userId,
      p_gmail_email: gmailEmail,
      p_encrypted_refresh_token: encryptedRefreshToken,
      p_encrypted_access_token: encryptedAccessToken,
      p_token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
    })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        new URL('/settings?gmail=error&reason=db_error', request.url)
      )
    }

    return NextResponse.redirect(
      new URL('/settings?gmail=connected', request.url)
    )
  } catch (err) {
    console.error('Gmail callback error:', err)
    return NextResponse.redirect(
      new URL('/settings?gmail=error&reason=unknown', request.url)
    )
  }
}
