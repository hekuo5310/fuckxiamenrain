import { getCloudflareContext } from '@opennextjs/cloudflare'

// Workers 绑定类型。
// D1Database / KVNamespace 是 @cloudflare/workers-types 提供的全局类型。
// SendEmail 在不同版本的 workers-types 中定义不一致，这里用一个最小结构
// 兜底，避免在未生成 worker-configuration.d.ts 时编译报错。
// 真实类型由 `npm run cf:types`（wrangler types）注入到全局。
export interface SendEmailBinding {
  send(message: unknown): Promise<void>
}

export interface Env {
  /** D1 数据库，binding 名对应 wrangler.toml [[d1_databases]] binding */
  pixel_ride: D1Database
  /** CF Email Send 绑定（生产环境必须，dev 可选） */
  MAILER?: SendEmailBinding
  /** KV（预留：限流 / session 缓存） */
  SESSION_KV?: KVNamespace
  APP_NAME: string
  APP_TAGLINE: string
  FROM_EMAIL: string
  /** session HMAC 密钥，经 `wrangler secret put SESSION_SECRET` 注入 */
  SESSION_SECRET?: string
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
