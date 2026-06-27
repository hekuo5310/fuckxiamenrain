import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/db'
import { getSessionFromCookies } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) {
    return NextResponse.json({ user: null })
  }
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, verified: true, createdAt: true },
  })
  if (!user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({ user })
}
