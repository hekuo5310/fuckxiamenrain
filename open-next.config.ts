// OpenNext for Cloudflare 构建配置。
// 通过 @opennextjs/cloudflare 把 `next build` 产物编译成单个 Worker，
// 输出到 .open-next/worker.js（由 wrangler.toml 的 main 字段消费）。
//
// 首次安装：bun add -D @opennextjs/cloudflare
// 构建：    bun run cf:build
import { defineCloudflareConfig } from '@opennextjs/cloudflare'

export default defineCloudflareConfig()
