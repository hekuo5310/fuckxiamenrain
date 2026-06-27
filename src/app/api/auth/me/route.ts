import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ user: null })
  }
  const u = await db.user.findById(session.userId)
  if (!u) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      verified: !!u.verified,
      createdAt: u.createdAt,
    },
  })
}
