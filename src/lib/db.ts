import { PrismaClient } from '@prisma/client'

// 本地开发：Prisma + SQLite 单例。
// 上 Cloudflare Workers 时本模块需替换为 D1 后端客户端：
//   - 用 @prisma/adapter-d1 包装 env.DB，或
//   - 直接调用原生 env.DB.prepare(...)。
// 详见 README「部署就绪状态」与 wrangler.toml 的 [[d1_databases]]。
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db