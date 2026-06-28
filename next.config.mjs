/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

// 本地 dev：启动 miniflare，让 route handler 经 getCloudflareContext() 拿到
// wrangler.toml 中的 D1 / KV / Email 绑定。
// 生产构建时该函数 no-op，不影响 deploy。
// 用 .mjs（ESM）而非 .ts，避免 Next 编译 config 为 CJS 时顶层 await 报
// ERR_REQUIRE_ASYNC_MODULE。
if (process.env.NODE_ENV === 'development') {
  const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}

export default nextConfig;
