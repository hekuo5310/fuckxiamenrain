import { createHash, timingSafeEqual } from 'crypto'

// 密码哈希用 WebCrypto PBKDF2（Workers + Node 通用，单次 deriveBits 原生调用，
// 避免 Node crypto 多轮循环在 Workers CPU 限制下超时）。
// session 用 HMAC-SHA256，createHash 单次调用，nodejs_compat 下可接受。
// SESSION_SECRET 经 `wrangler secret put SESSION_SECRET` 注入，Workers 上 process.env 可读。

const enc = new TextEncoder()

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'pixel-ride-dev-secret-change-me-in-prod-9f2a7c'

function toHex(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) s += buf[i].toString(16).padStart(2, '0')
  return s
}
function fromHex(s: string): Uint8Array {
  const arr = new Uint8Array(s.length / 2)
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(s.substr(i * 2, 2), 16)
  return arr
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 100000
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256
  )
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
    const iterations = parseInt(parts[1], 10)
    const salt = fromHex(parts[2])
    const expected = fromHex(parts[3])
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      keyMaterial,
      256
    )
    const a = new Uint8Array(bits)
    if (a.length !== expected.length) return false
    return timingSafeEqual(a, expected)
  } catch {
    return false
  }
}

export interface SessionPayload {
  userId: string
  email: string
  displayName: string
  iat: number
  exp: number
}

export function createSession(user: { id: string; email: string; displayName: string }): string {
  const iat = Date.now()
  const exp = iat + 1000 * 60 * 60 * 24 * 7 // 7 天
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
