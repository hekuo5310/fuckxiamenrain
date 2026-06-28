import { getCloudflareContext } from '@opennextjs/cloudflare'

// Workers 绑定类型。依赖 `wrangler types`（npm run cf:types）生成的
// worker-configuration.d.ts 提供全局 D1Database / KVNamespace / SendEmail 类型。
export interface Env {
  /** D1 数据库，binding 名对应 wrangler.toml [[d1_databases]] binding */
  pixel_ride: D1Database
  /** CF Email Send 绑定 */
  MAILER: SendEmail
  /** KV（预留：限流 / session 缓存） */
  SESSION_KV: KVNamespace
  APP_NAME: string
  APP_TAGLINE: string
  FROM_EMAIL: string
}

/**
 * 取当前请求的 Workers env 绑定。
 * 用 { async: true } —— edge runtime 下同步调用会抛错，async 形式 nodejs/edge 通用。
 * 生产：OpenNext 注入 request scope 的 ctx。
 * 本地 dev：需 next.config.mjs 的 initOpenNextCloudflareForDev() 已启动 miniflare。
 */
export async function getEnv(): Promise<Env> {
  const ctx = await getCloudflareContext({ async: true })
  return ctx.env as unknown as Env
}
