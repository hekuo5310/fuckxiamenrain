import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getEnv } from '@/lib/cloudflare'

// Prisma + D1 adapter（binding: pixel_ride）。
// Workers 无全局单例——每请求从 getCloudflareContext() 取 D1 binding 构造 client。
// D1 adapter 轻量，per-request 构造可接受。
export async function getPrisma(): Promise<PrismaClient> {
  const env = await getEnv()
  return new PrismaClient({
    adapter: new PrismaD1(env.pixel_ride),
    log: ['error', 'warn'],
  })
}
