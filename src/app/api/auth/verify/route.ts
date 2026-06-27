import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: '未登录 / Not logged in' }, { status: 401 })
  }

  const code = String(body?.code || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: '验证码格式不正确（6 位数字）' }, { status: 400 })
  }

  const record = await db.verificationCode.findLatestUnconsumed(session.email, 'register')

  if (!record) {
    return NextResponse.json({ error: '请先发送验证码 / No code issued' }, { status: 404 })
  }
  if (new Date(record.expiresAt) < new Date()) {
    return NextResponse.json({ error: '验证码已过期，请重新发送' }, { status: 410 })
  }
  if (record.code !== code) {
    return NextResponse.json({ error: '验证码不正确' }, { status: 400 })
  }

  // 原子：消费验证码 + 标记用户已验证
  await db.batch([
    { sql: 'UPDATE VerificationCode SET consumed = 1 WHERE id = ?', params: [record.id] },
    { sql: 'UPDATE User SET verified = 1, updatedAt = ? WHERE id = ?', params: [new Date().toISOString(), session.userId] },
  ])

  const u = await db.user.findById(session.userId)
  return NextResponse.json({
    ok: true,
    user: u && { id: u.id, email: u.email, displayName: u.displayName, verified: !!u.verified },
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 })
}
