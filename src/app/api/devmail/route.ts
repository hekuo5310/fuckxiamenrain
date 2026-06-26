import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

// Read the in-app "dev mailbox" (simulates Cloudflare Email Send output).
export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ mails: [] })
  }
  const mails = await db.devMail.findMany({
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
  await db.devMail.deleteMany({
    where: { OR: [{ userId: session.userId }, { toEmail: session.email }] },
  })
  return NextResponse.json({ ok: true })
}
