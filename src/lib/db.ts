import { getEnv } from '@/lib/cloudflare'

// D1 数据访问层（binding: pixel_ride）。替代 Prisma/SQLite。
// 方法名贴近原 Prisma 调用，路由改动最小。
// 类型：依赖 wrangler types 生成的全局 D1Database（bun run cf:types）。

// ── 行类型 ──────────────────────────────────────────────────────────────────
export interface UserRow {
  id: string
  email: string
  passwordHash: string
  displayName: string
  verified: number // D1 存 INTEGER 0/1
  createdAt: string
  updatedAt: string
}
export interface ScoreRow {
  id: string
  userId: string
  score: number
  distance: number
  survivalMs: number
  maxHp: number
  finalRep: number
  umbrellaMs: number
  crashes: number
  createdAt: string
}
export interface VerifCodeRow {
  id: string
  email: string
  code: string
  purpose: string
  expiresAt: string
  consumed: number
  createdAt: string
}
export interface DevMailRow {
  id: string
  userId: string | null
  toEmail: string
  subject: string
  body: string
  createdAt: string
}

// ── 底层工具 ─────────────────────────────────────────────────────────────────
function d1(): D1Database {
  return getEnv().pixel_ride
}

function genId(): string {
  // crypto.randomUUID 在 Workers 与 Node 均可用
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24)
}

async function first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await d1().prepare(sql).bind(...params).first<T>()) ?? null
}
async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await d1().prepare(sql).bind(...params).all<T>()
  return r.results ?? []
}
async function run(sql: string, ...params: unknown[]): Promise<void> {
  await d1().prepare(sql).bind(...params).run()
}

// ── User ────────────────────────────────────────────────────────────────────
export const user = {
  async findByEmail(email: string): Promise<UserRow | null> {
    return first<UserRow>('SELECT * FROM User WHERE email = ? LIMIT 1', email)
  },
  async findById(id: string): Promise<UserRow | null> {
    return first<UserRow>('SELECT * FROM User WHERE id = ? LIMIT 1', id)
  },
  async create(data: {
    email: string
    passwordHash: string
    displayName: string
    verified?: boolean
  }): Promise<{ id: string }> {
    const id = genId()
    const now = new Date().toISOString()
    await run(
      'INSERT INTO User (id, email, passwordHash, displayName, verified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      data.email,
      data.passwordHash,
      data.displayName,
      data.verified ? 1 : 0,
      now,
      now
    )
    return { id }
  },
  async setVerified(id: string, verified: boolean): Promise<void> {
    await run('UPDATE User SET verified = ?, updatedAt = ? WHERE id = ?', verified ? 1 : 0, new Date().toISOString(), id)
  },
  async setDisplayName(id: string, displayName: string): Promise<void> {
    await run('UPDATE User SET displayName = ?, updatedAt = ? WHERE id = ?', displayName, new Date().toISOString(), id)
  },
}

// ── Score ───────────────────────────────────────────────────────────────────
export const score = {
  async create(data: {
    userId: string
    score: number
    distance: number
    survivalMs: number
    maxHp: number
    finalRep: number
    umbrellaMs: number
    crashes: number
  }): Promise<{ id: string }> {
    const id = genId()
    await run(
      'INSERT INTO Score (id, userId, score, distance, survivalMs, maxHp, finalRep, umbrellaMs, crashes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      data.userId,
      data.score,
      data.distance,
      data.survivalMs,
      data.maxHp,
      data.finalRep,
      data.umbrellaMs,
      data.crashes,
      new Date().toISOString()
    )
    return { id }
  },
  async findByUser(userId: string, take = 20): Promise<ScoreRow[]> {
    return all<ScoreRow>('SELECT * FROM Score WHERE userId = ? ORDER BY createdAt DESC LIMIT ?', userId, take)
  },
  async findTopWithUser(limit: number): Promise<Array<ScoreRow & { displayName: string; email: string }>> {
    return all<ScoreRow & { displayName: string; email: string }>(
      'SELECT s.*, u.displayName, u.email FROM Score s JOIN User u ON u.id = s.userId ORDER BY s.score DESC LIMIT ?',
      limit
    )
  },
}

// ── VerificationCode ─────────────────────────────────────────────────────────
export const verificationCode = {
  async invalidateUnconsumed(email: string, purpose: string): Promise<void> {
    await run(
      'UPDATE VerificationCode SET consumed = 1 WHERE email = ? AND purpose = ? AND consumed = 0',
      email,
      purpose
    )
  },
  async create(data: { email: string; code: string; purpose: string; expiresAt: string }): Promise<{ id: string }> {
    const id = genId()
    await run(
      'INSERT INTO VerificationCode (id, email, code, purpose, expiresAt, consumed, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)',
      id,
      data.email,
      data.code,
      data.purpose,
      data.expiresAt,
      new Date().toISOString()
    )
    return { id }
  },
  async findLatestUnconsumed(email: string, purpose: string): Promise<VerifCodeRow | null> {
    return first<VerifCodeRow>(
      'SELECT * FROM VerificationCode WHERE email = ? AND purpose = ? AND consumed = 0 ORDER BY createdAt DESC LIMIT 1',
      email,
      purpose
    )
  },
  async markConsumed(id: string): Promise<void> {
    await run('UPDATE VerificationCode SET consumed = 1 WHERE id = ?', id)
  },
}

// ── DevMail（本地 dev 邮箱落库）──────────────────────────────────────────────
export const devMail = {
  async create(data: { userId: string | null; toEmail: string; subject: string; body: string }): Promise<void> {
    const id = genId()
    await run(
      'INSERT INTO DevMail (id, userId, toEmail, subject, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      data.userId,
      data.toEmail,
      data.subject,
      data.body,
      new Date().toISOString()
    )
  },
  async findByUserOrEmail(userId: string, email: string, take = 10): Promise<DevMailRow[]> {
    return all<DevMailRow>(
      'SELECT * FROM DevMail WHERE userId = ? OR toEmail = ? ORDER BY createdAt DESC LIMIT ?',
      userId,
      email,
      take
    )
  },
  async deleteByUserOrEmail(userId: string, email: string): Promise<void> {
    await run('DELETE FROM DevMail WHERE userId = ? OR toEmail = ?', userId, email)
  },
}

// ── 批处理（多语句原子执行）──────────────────────────────────────────────────
export async function batch(stmts: Array<{ sql: string; params: unknown[] }>): Promise<void> {
  await d1().batch(stmts.map((s) => d1().prepare(s.sql).bind(...s.params)))
}

// 兼容旧 import：`import { db } from '@/lib/db'`
export const db = { user, score, verificationCode, devMail, batch }
