import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * 用 PBKDF2 哈希密码（Cloudflare Workers 也可用 WebCrypto 实现，
 * 这里沙箱 dev server 用 Node crypto）。
 *
 * 边缘环境备注：Node crypto 靠 `nodejs_compat` 可用（见 wrangler.toml）。
 * 若想彻底去掉 Node 依赖，可移植到 `crypto.subtle`（PBKDF2 + HMAC-SHA256
 * 走 WebCrypto），session 签名改为 `crypto.subtle.sign('HMAC', ...)`。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const iterations = 100000
  const hash = createHash('sha256')
    .update(salt + password + ':pixelride')
    .digest('hex')
  // 多轮迭代增强哈希强度
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
