# 🚲 Pixel Ride · 雨中骑车上学路

> 一个吐槽 2026/06/26 厦门大雨的像素风第一人称骑车网页游戏。
> 清晨下暴雨，可你还得骑车去上学。一手撑伞，一手扶把，
> 蜗牛在路面慢吞吞地爬，行人在斑马线上踱步，水坑一个接一个——
> 最糟的是，迟到的同学正在后面猛追，想抄你的车把！

![游戏画面](./screenshot-gameplay.png)
![游戏结束](./screenshot-gameover.png)

---

## ✨ 特性

- **第一人称像素渲染** — 320×200 低分辨率，硬边像素，暖色大地系调色（terracotta / sepia / moss / wheat），CRT 扫描线质感，无蓝紫。
- **撑伞系统** — 空格切换。撑伞速度 −20%，水坑溅水伤害 −75%，雨天缓慢回血；收伞全速但雨大时持续掉血。
- **同学追逐** — 保持高速（>0.4）才能甩开，低速被追近，碰撞额外拉近，归零即被追上 = 游戏结束。近距离有红色追赶剪影 + 红色 vignette 脉动警告。
- **障碍与事件** — 蜗牛（碾到 −人品 +拖延）、横穿马路的行人（50% 被揍 −HP / 50% 被骂 −人品）、水坑（伤害 = 速度 × 水深）、热咖啡拾取（+HP +Combo 拉开同学）。
- **天气与难度曲线** — 雨强 0~1 随机波动，影响掉血与水坑深度；刷怪间隔 1.5s→0.55s，90s 后双倍刷怪。
- **账号系统** — 邮箱注册 + PBKDF2 密码哈希 + HMAC 签名 session cookie；6 位验证码（15 分钟有效）；成绩提交需已验证账号；前 20 排行榜。
- **开发邮箱面板** — 沙箱环境下验证码写入 `DevMail` 表，可在应用内直接查看并一键填入，端到端可玩。
- **响应式** — 桌面键位 + 移动端虚拟按键，390×844 适配。

## 🎮 操作

| 按键 | 动作 |
|------|------|
| `←` `→` / `A` `D` | 左右变道 |
| `↑` / `W` | 踩踏加速（甩开同学） |
| `↓` / `S` | 刹车减速 |
| `空格` | 撑起 / 收起雨伞 |
| `P` | 暂停 |
| `Enter` | 开始 / 重玩 |

移动端使用屏幕虚拟按键。

## 🧱 技术栈

- **Next.js 16**（App Router）+ **TypeScript** + **React 19**
- **Tailwind CSS 4** + **shadcn/ui**（new-york）
- **Cloudflare D1**（SQLite 兼容）+ **Email Send** + **KV**，经 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 跑在 Workers
- 密码哈希 WebCrypto PBKDF2，session 用 HMAC 签名 cookie（无服务端存储，适配 Workers 无状态）
- `prisma/schema.prisma` 仅作 schema 参考，运行时数据访问走 D1 原生 SQL（见 `src/lib/db.ts`）

## 📁 项目结构

```
src/
├─ app/
│  ├─ api/                # 路由处理器
│  │  ├─ auth/{register,login,logout,me,verify}/
│  │  ├─ scores/          # 提交成绩（需验证）+ 个人历史
│  │  ├─ leaderboard/     # 前 20 排行榜
│  │  └─ devmail/         # 开发邮箱读取/清空
│  ├─ layout.tsx · page.tsx · globals.css
├─ components/
│  ├─ game/               # PixelRideGame / AuthPanel / VerifyPanel / DevMailbox / Leaderboard
│  └─ ui/                 # shadcn/ui 组件
├─ lib/
│  ├─ auth.ts             # WebCrypto PBKDF2 哈希 + HMAC session
│  ├─ cloudflare.ts       # getEnv()：从 getCloudflareContext() 取 D1/KV/Email 绑定
│  ├─ db.ts               # D1 数据访问层（binding pixel_ride，原生 SQL）
│  ├─ email.ts            # 生产 env.MAILER.send(EmailMessage)，dev 落 DevMail
│  └─ game/engine.ts      # 像素游戏引擎
└─ hooks/
prisma/schema.prisma      # schema 参考（运行时不用 Prisma）
migrations/0001_init.sql  # D1 初始 schema（User/Score/VerificationCode/DevMail）
wrangler.toml             # Cloudflare Workers 部署配置
open-next.config.ts       # OpenNext 构建配置
```

## 🚀 本地开发

需要 Node 20+ 与 [bun](https://bun.sh)（项目用 `bun.lock`）。本地 dev 经 OpenNext 的 `initOpenNextCloudflareForDev()` 启动 miniflare，让 `next dev` 也能拿到 wrangler.toml 的 D1/KV/Email 绑定。

```bash
bun install
cp .env.example .env            # 编辑 SESSION_SECRET
bun run cf:types                # 生成 worker-configuration.d.ts（D1/KV/Email 类型）
bun run d1:migrate:local        # 本地 miniflare D1 建表
bun run dev                     # http://localhost:3000
```

常用脚本：

```bash
bun run lint                  # ESLint
bun run d1:query:local "SQL"  # 本地 D1 查询，如 "SELECT * FROM User"
bun run build                 # Next.js standalone 构建
```

> 本地 dev 下邮件不发真信，验证码落 DevMail 表，可在页面右侧 **开发邮箱** 面板查看，或读 `dev.log` 中 `[mail] ...` 日志。

## ☁️ Cloudflare 部署

Next.js App Router 跑在 Workers 上，经 [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) 把 `next build` 产物编译成单个 Worker。

### 1. 安装边缘依赖

```bash
bun add -D wrangler @opennextjs/cloudflare
bun install
```

### 2. 创建 D1 并写回 database_id

```bash
wrangler login
wrangler d1 create pixel-ride
# 把返回的 database_id 填入 wrangler.toml 的 database_id（含 env.production）
```

### 3. 应用 D1 迁移

```bash
bun run d1:migrate:remote     # wrangler d1 migrations apply pixel-ride --remote
```

### 4. 设置密钥

```bash
wrangler secret put SESSION_SECRET      # 32+ 位随机串：openssl rand -hex 32
```

### 5. 生成类型、构建并部署

```bash
bun run cf:types              # wrangler types → worker-configuration.d.ts（D1/KV/Email 类型）
bun run cf:build              # npx @opennextjs/cloudflare build → .open-next/
bun run cf:deploy             # wrangler deploy
bun run cf:tail               # 实时日志
```

### Email Send 绑定

`wrangler.toml` 已声明 `[[send_email]] name = "MAILER"`，`src/lib/email.ts` 生产环境直接调用 `env.MAILER.send(new EmailMessage(from, to, mimeMsg))`，MIME 由 `mimetext` 构造。两种模式二选一：

- **已验证收件地址（测试）**：`destination_address = "已验证邮箱"`（仅能发往该地址）。
- **自定义域名（生产）**：`enabled = true` + 在发件域名配置 SPF/DKIM 验证。

本地 dev 不发真信，验证码落 DevMail 表供「开发邮箱」面板查看。

## ✅ 部署就绪状态

D1 + Email Send + auth 均已切到 Workers 原生实现，本地 dev 与生产同源代码：

| 模块 | 实现 |
|------|------|
| 前端 / 游戏引擎 | Next.js + Canvas，OpenNext 构建到 Workers |
| 路由 / API | Next.js route handler，Node runtime 经 `nodejs_compat` |
| 数据访问 `db.ts` | D1 原生 SQL（binding `pixel_ride`），`getCloudflareContext()` 取 env |
| 密码哈希 `auth.ts` | WebCrypto PBKDF2（单次 `deriveBits`，不超 Workers CPU 限制） |
| session | HMAC-SHA256 签名 cookie，无服务端存储 |
| 邮件 `email.ts` | 生产 `env.MAILER.send(EmailMessage)`；dev 落 DevMail 表 |

> `prisma/schema.prisma` 与 `db/custom.db` 为历史 Prisma/SQLite 遗留，仅作参考，运行时不使用。可按需删除。

## 🗺 路线图

- 每日挑战 / 道具商店（雨衣、车铃、加速水）/ 成就系统 / 好友对战
- 路面类型（减速带、下坡加速、逆风）、Boss 同学、昼夜循环
- 像素字体按钮 hover、过场动画、角色与场景选择（校园/公园/闹市）
- Web Audio 合成 8-bit 音效（车铃、碰撞、雨声、心跳警告）
- 排行榜分页 / 维度排序 / 个人最佳高亮 / 反作弊阈值

## 📜 许可证

见 [LICENSE](./LICENSE)。
