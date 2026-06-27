import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

// 读取应用内「开发邮箱」（模拟 CF Email Send 输出）
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ mails: [] })
  }
  const mails = await db.devMail.findByUserOrEmail(session.userId, session.email, 10)
  return NextResponse.json({
    mails: mails.map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      toEmail: m.toEmail,
      createdAt: m.createdAt,
    })),
  })
}

export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }
  await db.devMail.deleteByUserOrEmail(session.userId, session.email)
  return NextResponse.json({ ok: true })
}
