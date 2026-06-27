import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(50, Math.max(5, Number(searchParams.get('limit') || 20)))

  const rows = await db.score.findTopWithUser(limit)

  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    score: r.score,
    distance: r.distance,
    survivalMs: r.survivalMs,
    maxHp: r.maxHp,
    finalRep: r.finalRep,
    umbrellaMs: r.umbrellaMs,
    crashes: r.crashes,
    createdAt: r.createdAt,
    displayName: r.displayName,
    emailHash: r.email,
  }))

  return NextResponse.json({ leaderboard })
}
