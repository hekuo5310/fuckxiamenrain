import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

// 本地 dev：启动 miniflare，让 route handler 经 getCloudflareContext() 拿到
// wrangler.toml 中的 D1 / KV / Email 绑定。包未安装时降级仅告警。
// 生产构建时该函数 no-op，不影响 deploy。
if (process.env.NODE_ENV === 'development') {
  try {
    const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare')
    initOpenNextCloudflareForDev()
  } catch {
    console.warn(
      '[pixel-ride] @opennextjs/cloudflare 未安装，本地 dev 无 D1/KV/Email 绑定；先 npm install。'
    )
  }
}

export default nextConfig;
