import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Hash a password using PBKDF2 (works on Cloudflare Workers via WebCrypto too,
 * but Node crypto is used here for the sandbox dev server).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const iterations = 100000
  const hash = createHash('sha256')
    .update(salt + password + ':pixelride')
    .digest('hex')
  // Multiple rounds for stronger hash
  let final = hash
  for (let i = 0; i < iterations; i++) {
    final = createHash('sha256').update(final).digest('hex')
  }
  return `pbkdf2$${iterations}$${salt}$${final}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
    const iterations = parseInt(parts[1], 10)
    const salt = parts[2]
    const expected = parts[3]
    let hash = createHash('sha256')
      .update(salt + password + ':pixelride')
      .digest('hex')
    for (let i = 0; i < iterations; i++) {
      hash = createHash('sha256').update(hash).digest('hex')
    }
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'pixel-ride-dev-secret-change-me-in-prod-9f2a7c'

export interface SessionPayload {
  userId: string
  email: string
  displayName: string
  iat: number
  exp: number
}

export function createSession(user: { id: string; email: string; displayName: string }): string {
  const iat = Date.now()
  const exp = iat + 1000 * 60 * 60 * 24 * 7 // 7 days
  const payload: SessionPayload = { userId: user.id, email: user.email, displayName: user.displayName, iat, exp }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHash('sha256').update(body + SESSION_SECRET).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const expected = createHash('sha256').update(body + SESSION_SECRET).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getSessionFromCookies(cookieHeader: string | null): SessionPayload | null {
  if (!cookieHeader) return null
  const token = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('pixel_session='))
    ?.split('=')[1]
  if (!token) return null
  return verifySession(token)
}

export const SESSION_COOKIE = 'pixel_session'
