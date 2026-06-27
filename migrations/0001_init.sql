-- ──────────────────────────────────────────────────────────────────────────
-- Pixel Ride — D1 初始 schema
-- 镜像 prisma/schema.prisma（User / Score / VerificationCode / DevMail）。
--
-- 本地应用：wrangler d1 migrations apply pixel-ride --local
-- 远程应用：wrangler d1 migrations apply pixel-ride --remote
-- ──────────────────────────────────────────────────────────────────────────

-- 用户表 ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS User (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  email        TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  displayName  TEXT NOT NULL,
  verified     INTEGER NOT NULL DEFAULT 0,
  createdAt    TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 游戏成绩表 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Score (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  userId     TEXT NOT NULL,
  score      INTEGER NOT NULL,
  distance   INTEGER NOT NULL,   -- 行驶米数
  survivalMs INTEGER NOT NULL,   -- 存活时间（毫秒）
  maxHp      INTEGER NOT NULL,
  finalRep   INTEGER NOT NULL,
  umbrellaMs INTEGER NOT NULL,   -- 撑伞时长
  crashes    INTEGER NOT NULL,   -- 总碰撞次数
  createdAt  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_score_score  ON Score(score);
CREATE INDEX IF NOT EXISTS idx_score_userId ON Score(userId);

-- 邮箱验证码表（注册 / 重置）────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS VerificationCode (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  email     TEXT NOT NULL,
  code      TEXT NOT NULL,
  purpose   TEXT NOT NULL DEFAULT 'register',  -- register | reset
  expiresAt TEXT NOT NULL,
  consumed  INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_verifcode_email_purpose ON VerificationCode(email, purpose);

-- 开发邮箱表（沙箱投递落库；类似 KV 的邮箱）────────────────────────────────
CREATE TABLE IF NOT EXISTS DevMail (
  id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  userId    TEXT,
  toEmail   TEXT NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_devmail_userId ON DevMail(userId);
