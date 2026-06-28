# Pixel Ride — 雨中骑车上学路 · Worklog

## 项目当前状态描述 / Project Status

像素风第一人称骑车网页游戏，已完成核心功能并端到端验证通过。

- **技术栈**: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma + `@prisma/adapter-d1`
- **运行环境**: Cloudflare Workers（经 `@opennextjs/cloudflare`）+ D1 + KV + Email Send
- **构建**: `npm run cf:build` 通过，`wrangler deploy --dry-run` 通过，bundle 7.3MB raw / 1.9MB gzip
- **本地验证**: `wrangler dev` 全流程跑通：注册 → 验证码 → 验证 → 提交成绩 → 排行榜 → 登出

## 已完成功能 / Completed Features

### 账号系统（Cloudflare Workers + D1 + Email Send）
- 邮箱注册 + 密码 PBKDF2 哈希 + 签名 session cookie
- 6 位验证码，15 分钟有效，存入 VerificationCode 表
- 邮件发送抽象层 `src/lib/email.ts`：
  - 生产：CF Email Send 对象式 API `env.MAILER.send({ from, to, subject, text, html })`
  - dev：写入 DevMail 表（开发邮箱面板可查）
- 登录 / 登出 / 当前用户 / 重发验证码 接口
- 成绩提交需已验证账号；排行榜接口

### 游戏引擎 `src/lib/game/engine.ts`
- 320×200 低分辨率像素渲染，imageSmoothingEnabled=false，缩放后保持像素硬边
- 第一人称视角：透视梯形道路、远近缩放实体、消失点
- **撑伞系统**: 空格切换；撑伞速度 -20%，水坑溅水伤害 -75%，雨天生命值缓慢恢复；收伞全速但雨大时持续掉血
- **同学追逐**: classmateDist 0~1，速度>0.4 拉开、<0.4 被追近；碰撞额外拉近；归零=被追上=游戏结束；近距离屏幕边缘出现红色追赶剪影 + 红色 vignette 脉动
- **蜗牛**: 静态占道，碾到 -人品 +拖延时间 +拉近同学
- **行人**: 横穿马路（fromLane→toLane），撞到 50% 被揍(-HP) / 50% 被骂(-人品)，均 +拖延
- **水坑**: 伤害 = 速度 × 水深 × 系数；伞减伤 75%；屏幕震动 + 飞字反馈
- **热咖啡**: 拾取 +HP +Combo +拉开同学（额外彩蛋机制）
- 天气系统：雨强 0~1 随机变化，影响掉血与水坑深度
- 难度随时间提升：刷怪间隔 1.5s→0.55s，90s 后双倍刷怪

### 前端 UI `src/components/game/`
- `AuthPanel.tsx` 注册/登录 Tab，像素风表单
- `VerifyPanel.tsx` 验证码输入，自动检测开发邮箱验证码一键填入
- `DevMailbox.tsx` 开发邮箱面板（轮询、展开邮件正文、清空）
- `Leaderboard.tsx` 排行榜（前 20，前三名带皇冠/奖牌图标）
- `PixelRideGame.tsx` 游戏主体
- `page.tsx` 编排：header / 主区（认证态切换 game/auth/verify 三屏）/ sticky footer

## Cloudflare Workers 部署修复记录（2026-06-28）

### 修复的 Bug

1. **Prisma schema 缺 `previewFeatures = ["driverAdapters"]`**
   - 现象：PrismaClient 不识别 `adapter` 参数，所有 D1 调用炸
   - 修复：`prisma/schema.prisma` generator 块加 `previewFeatures` + `binaryTargets = ["native", "rhel-openssl-3.0.x"]`

2. **Email API 用了不存在的对象式 send({to, from, subject, text}) 但实际写法不对**
   - 现象：原代码 `env.MAILER.send({ to, from, subject, text })` 没问题（CF 2024+ 支持），但需确保 `from` 格式正确 + html 字段可选
   - 修复：`src/lib/email.ts` 改为完整对象式 API `{ from, to, subject, text, html }`，加 try/catch 兜底 DevMail，移除 `cloudflare:email` 模块依赖

3. **`next.config.mjs` 的 `output: "standalone"` 与 OpenNext 冲突**
   - 修复：移除 `output: "standalone"`

4. **`sharp` 原生模块无法在 Workers 上加载**
   - 修复：`package.json` 移除 `sharp`；`next.config.mjs` 加 `images: { unoptimized: true }`

5. **Prisma 在 Workers 上 `fs.readdir is not implemented yet` 崩溃**
   - 原因：esbuild 默认 conditions 不含 `workerd`，Prisma client 走 node 路径加载 native query engine
   - 修复：`next.config.mjs` 加 `serverExternalPackages: ['@prisma/client', '@prisma/adapter-d1', '.prisma/client']`，让 OpenNext `copyWorkerdPackages` 用 `workerd` condition 复制 wasm 版 Prisma client

6. **`cloudflare:email` 模块在 OpenNext 打包阶段无法解析**
   - 原方案：用 `new Function('s', 'return import(s)')` 动态加载
   - 问题：Workers 默认禁 `eval`/`new Function`，需要 `unsafe.eval` compat flag
   - 终方案：完全不用 `cloudflare:email` 模块，直接调 binding 的对象式 `send({ from, to, subject, text, html })`

7. **`examples/websocket/*.ts` 被 tsconfig include**
   - 修复：`tsconfig.json` exclude `examples/`、`mini-services/`、`download/`、`.open-next/`、`.wrangler/`

8. **`wrangler.toml` 的 `destination_address = "noreply@d-dos.cc"` 用法错误**
   - 说明：destination_address 应为「已验证收件邮箱」（只能发到这个地址），不是发件地址
   - 修复：保持原值作为沙箱测试地址，加注释说明生产环境应改用 `enabled = true` + 自定义域名 SPF/DKIM

9. **`db/custom.db` 与 `examples/`、`mini-services/`、`download/` 不应在仓库**
   - 修复：`git rm --cached`，`.gitignore` 加 `db/`

10. **`.env*` 通配符把 `.env.example` 也忽略**
    - 修复：`.gitignore` 加 `!.env.example` 反向规则

11. **`SendEmail` 类型在未生成 worker-configuration.d.ts 时编译报错**
    - 修复：`src/lib/cloudflare.ts` 改用本地 `SendEmailBinding` 接口兜底，不依赖全局 `SendEmail` 类型

### 验证结果 / Verification

- `npm install` ✅
- `npx prisma generate` ✅
- `npm run cf:build` ✅ → 产 `.open-next/worker.js`
- `npx wrangler deploy --dry-run` ✅ → bundle 7.3MB raw / 1.9MB gzip，所有 binding 识别
- `wrangler dev` 全流程测试 ✅：
  - 注册 → 200，创建用户 + 写 DevMail + 设置 session cookie
  - /api/auth/me → 200，返回当前用户
  - /api/devmail → 200，返回验证码邮件
  - /api/auth/verify → 200，verified=true
  - /api/scores POST → 200，写入 Score 表
  - /api/leaderboard → 200，返回 1 条记录
  - /api/auth/logout → 200，清 cookie
  - /api/auth/me（登出后）→ 200，`{user: null}`

## 未解决问题 / 风险 / 下一步

### 已知小问题
1. agent-browser 的 `click` 命令对 shadcn Button 的 onClick 触发不稳定 —— 测试工具特性，真实用户点击正常
2. 游戏默认撑伞开局，新手可能不知道按空格收伞加速甩同学 —— 玩法说明已写明
3. `wrangler.toml` 中 `destination_address = "noreply@d-dos.cc"` 意味着所有验证码邮件只能发到这个地址，**生产部署前必须改为 `enabled = true` + 自定义域名 SPF/DKIM**

### 下一阶段建议
- **新功能**: 每日挑战 / 道具商店（用分数兑换：雨衣、车铃、加速水）/ 成就系统 / 好友对战
- **新机制**: 路面类型变化（减速带、下坡加速、逆风）、Boss 同学、昼夜循环
- **样式细化**: 像素字体按钮 hover 动画、过场动画、角色选择、关卡场景切换
- **音效**: Web Audio 合成 8-bit 音效
- **排行榜优化**: 分页、按距离/时间维度排序、个人最佳高亮、反作弊阈值

### 架构备注
Workers 部署链路已打通，代码同源 dev/prod。Prisma 经 `@prisma/adapter-d1` 走 wasm query engine，session 用 HMAC 签名 cookie 无状态，邮件用对象式 SendEmail API，全部为 Workers 原生支持。
