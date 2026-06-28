import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/db'
import { hashPassword, createSession, SESSION_COOKIE } from '@/lib/auth'
import { issueVerificationCode } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const displayName = String(body?.displayName || '').trim().slice(0, 16) || email.split('@')[0]

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确 / Invalid email' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '密码至少 6 位 / Password too short (min 6)' }, { status: 400 })
  }

  try {
    const prisma = await getPrisma()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: '该邮箱已注册 / Email already registered' }, { status: 409 })
    }

    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), displayName, verified: false },
    })

    await issueVerificationCode(email, 'register', user.id)

    // 自动登录（未验证），便于在应用内验证
    const token = createSession({ id: user.id, email, displayName })
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email, displayName, verified: false },
      message: '注册成功，验证码已发送到你的邮箱（开发环境请到"开发邮箱"面板查看）。',
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err: any) {
    // 返回 JSON 错误（含 message），避免空 body 500 让前端 res.json() 炸
    console.error('[register] error:', err)
    return NextResponse.json(
      { error: '注册服务异常', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 })
}
