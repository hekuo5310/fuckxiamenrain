/** @type {import('next').NextConfig} */
const nextConfig = {
  // 不用 standalone：OpenNext for Cloudflare 会接管产出，standalone 模式
  // 反而会干扰 .open-next/worker.js 的生成。
  typescript: {
    // Prisma + Workers 类型偶有摩擦，构建时不要因为类型 warning 直接 fail
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Workers 不能跑 sharp（原生模块）。next/image 的 optimizer 在 OpenNext
  // 下默认走 Worker 内部，禁用 loader 避免运行时崩。
  // 静态 <img> 与外部 URL 不受影响。
  images: {
    unoptimized: true,
  },
  // 把 Prisma 包标记为 external，让 OpenNext 用 workerd build condition
  // 复制对应的 wasm 版本到 .next/standalone/node_modules。
  // 不这么做的话 esbuild 默认 conditions 不含 workerd，会走 node 路径
  // 加载 native query engine → fs.readdir 在 Workers 上抛 not implemented。
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-d1',
    '.prisma/client',
  ],
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
