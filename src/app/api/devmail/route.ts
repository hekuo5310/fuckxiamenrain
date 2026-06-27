import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

// 读取应用内「开发邮箱」（模拟 CF Email Send 输出）
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ mails: [] })
  }
  const prisma = getPrisma()
  const mails = await prisma.devMail.findMany({
    where: { OR: [{ userId: session.userId }, { toEmail: session.email }] },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
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
  const prisma = getPrisma()
  await prisma.devMail.deleteMany({
    where: { OR: [{ userId: session.userId }, { toEmail: session.email }] },
  })
  return NextResponse.json({ ok: true })
}
