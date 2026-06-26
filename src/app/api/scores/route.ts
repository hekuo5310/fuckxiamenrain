import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

// Submit a game result. Requires verified account.
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }
  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user || !user.verified) {
    return NextResponse.json({ error: '请先验证邮箱后再提交成绩' }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const score = Math.max(0, Math.min(10_000_000, Math.floor(Number(body?.score) || 0)))
  const distance = Math.max(0, Math.min(10_000_000, Math.floor(Number(body?.distance) || 0)))
  const survivalMs = Math.max(0, Math.min(3_600_000, Math.floor(Number(body?.survivalMs) || 0)))
  const maxHp = Math.max(0, Math.min(1000, Math.floor(Number(body?.maxHp) || 0)))
  const finalRep = Math.max(-1000, Math.min(1000, Math.floor(Number(body?.finalRep) || 0)))
  const umbrellaMs = Math.max(0, Math.min(3_600_000, Math.floor(Number(body?.umbrellaMs) || 0)))
  const crashes = Math.max(0, Math.min(10000, Math.floor(Number(body?.crashes) || 0)))

  // basic anti-cheat sanity check: score roughly consistent with distance
  if (score > distance * 5 + 100000) {
    return NextResponse.json({ error: '成绩异常' }, { status: 400 })
  }

  const record = await db.score.create({
    data: { userId: user.id, score, distance, survivalMs, maxHp, finalRep, umbrellaMs, crashes },
  })

  // update display name if provided and different
  const newDisplayName = String(body?.displayName || '').trim().slice(0, 16)
  if (newDisplayName && newDisplayName !== user.displayName) {
    await db.user.update({ where: { id: user.id }, data: { displayName: newDisplayName } })
  }

  return NextResponse.json({ ok: true, id: record.id })
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ scores: [] })
  }
  const scores = await db.score.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json({ scores })
}
