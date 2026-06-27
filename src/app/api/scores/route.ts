import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

// 提交游戏成绩，需已验证账号
export async function POST(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }
  const user = await db.user.findById(session.userId)
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

  // 基础反作弊：分数与距离大致相符
  if (score > distance * 5 + 100000) {
    return NextResponse.json({ error: '成绩异常' }, { status: 400 })
  }

  const record = await db.score.create({
    userId: user.id,
    score,
    distance,
    survivalMs,
    maxHp,
    finalRep,
    umbrellaMs,
    crashes,
  })

  // 若提供且不同，更新昵称
  const newDisplayName = String(body?.displayName || '').trim().slice(0, 16)
  if (newDisplayName && newDisplayName !== user.displayName) {
    await db.user.setDisplayName(user.id, newDisplayName)
  }

  return NextResponse.json({ ok: true, id: record.id })
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ scores: [] })
  }
  const scores = await db.score.findByUser(session.userId, 20)
  return NextResponse.json({ scores })
}
