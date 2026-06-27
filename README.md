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
- **Prisma 6 / SQLite**（本地开发；生产目标为 Cloudflare D1）
- **Cloudflare Workers** 部署目标：D1 + Email Send +（可选 KV）

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
│  ├─ auth.ts             # PBKDF2 哈希 + HMAC session
│  ├─ db.ts               # Prisma 单例
│  ├─ email.ts            # 邮件抽象层（沙箱→DevMail，生产→CF Email Send）
│  └─ game/engine.ts      # 像素游戏引擎
└─ hooks/
prisma/schema.prisma      # User / Score / VerificationCode / DevMail
migrations/0001_init.sql  # D1 初始 schema（镜像 Prisma）
wrangler.toml             # Cloudflare Workers 部署配置
open-next.config.ts       # OpenNext 构建配置
```

## 🚀 本地开发

需要 Node 20+ 与 [bun](https://bun.sh)（项目用 `bun.lock`）。

```bash
bun install
cp .env.example .env            # 编辑 DATABASE_URL / SESSION_SECRET
bun run db:generate             # 生成 Prisma client
bun run db:push                 # 创建本地 SQLite 表
bun run dev                     # http://localhost:3000
```

常用脚本：

```bash
bun run lint          # ESLint
bun run db:studio     # Prisma Studio 可视化数据库
bun run build         # Next.js standalone 构建
```

> 注册后验证码可在页面右侧 **开发邮箱** 面板查看，或读取 `dev.log` 中 `[mail] ...` 日志。

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

### 5. 构建并部署

```bash
bun run cf:build              # npx @opennextjs/cloudflare build → .open-next/
bun run cf:deploy             # wrangler deploy
bun run cf:tail               # 实时日志
```

### Email Send 绑定

`wrangler.toml` 已声明 `[[send_email]] name = "MAILER"`。两种模式二选一：

- **沙箱/测试**：取消注释 `destination_address = "已验证收件箱"`（仅能发往该地址）。
- **生产**：`enabled = true` + 在发件域名配置 SPF/DKIM 验证。

生产环境下 `src/lib/email.ts` 的 `sendEmail` 应改为调用 `env.MAILER.send(...)`（见代码注释）。

## ⚠️ 部署就绪状态

| 模块 | 本地 dev | Cloudflare 边缘 |
|------|----------|------------------|
| 前端 / 游戏引擎 | ✅ | ✅（OpenNext 构建） |
| 路由 / API | ✅ | ✅ |
| `wrangler.toml` + D1 schema | ✅ | ✅（就绪） |
| 数据访问层 `db.ts` | ✅ Prisma/SQLite | ⏳ 需切到 D1 adapter（见下） |
| 密码哈希 `auth.ts` | ✅ Node crypto | ⏳ 需切 WebCrypto（`nodejs_compat` 已开） |
| 邮件 `email.ts` | ✅ DevMail | ⏳ 切 `env.MAILER.send(...)` |

**上生产前需完成的端口工作**（worklog 中标注的「CF 部署」收尾）：

1. **`src/lib/db.ts`** — 用 `@prisma/adapter-d1` 包装 D1 binding，或改为原生 `env.DB.prepare()`。当前 Prisma client 在 Workers 运行时无法直接连接 SQLite。
2. **`src/lib/auth.ts`** — `createHash`/`randomBytes`/`timingSafeEqual` 已靠 `nodejs_compat` 兼容；如需移除 Node 依赖可改用 `crypto.subtle` + WebCrypto。
3. **`src/lib/email.ts`** — `sendEmail` 改为 `env.MAILER.send({ from, to, subject, text })`，`env` 由 route handler 注入。

其余（session cookie、API 逻辑、schema）天然适配 Workers 无状态特性，无需改动。

## 🗺 路线图

- 每日挑战 / 道具商店（雨衣、车铃、加速水）/ 成就系统 / 好友对战
- 路面类型（减速带、下坡加速、逆风）、Boss 同学、昼夜循环
- 像素字体按钮 hover、过场动画、角色与场景选择（校园/公园/闹市）
- Web Audio 合成 8-bit 音效（车铃、碰撞、雨声、心跳警告）
- 排行榜分页 / 维度排序 / 个人最佳高亮 / 反作弊阈值
- 完成 D1 数据访问层端口，真正上线 Workers

## 📜 许可证

见 [LICENSE](./LICENSE)。
