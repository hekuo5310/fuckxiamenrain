import { getCloudflareContext } from '@opennextjs/cloudflare'

// Workers 绑定类型。依赖 `wrangler types`（bun run cf:types）生成的
// worker-configuration.d.ts 提供全局 D1Database / KVNamespace / SendEmail 类型；
// 或安装 @cloudflare/workers-types 兜底。
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
 * 生产：getCloudflareContext() 同步返回 request scope 的 ctx。
 * 本地 dev：需 next.config.ts 的 initOpenNextCloudflareForDev() 已启动 miniflare。
 */
export function getEnv(): Env {
  const ctx = getCloudflareContext()
  return ctx.env as unknown as Env
}
