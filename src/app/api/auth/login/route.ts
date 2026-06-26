import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, SESSION_COOKIE } from '@/lib/auth'
import { issueVerificationCode } from '@/lib/email'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')

  if (!email || !password) {
    return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  const token = createSession({ id: user.id, email: user.email, displayName: user.displayName })
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, displayName: user.displayName, verified: user.verified },
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 })
}

// Re-issue a verification code for the currently logged-in (unverified) user.
export async function PUT(req: NextRequest) {
  const { getSessionFromCookies } = await import('@/lib/auth')
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }
  if (session.email) {
    await issueVerificationCode(session.email, 'register', session.userId)
  }
  return NextResponse.json({ ok: true })
}
