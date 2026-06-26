# Pixel Ride — 雨中骑车上学路 · Worklog

## 项目当前状态描述 / Project Status

像素风第一人称骑车网页游戏，已完成核心功能并端到端验证通过。

- **技术栈**: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite（作为 D1 替代）
- **运行状态**: dev server 运行在 3000 端口，lint 通过，agent-browser 验证全流程通过
- **配色**: 暖色大地系（terracotta/sepia/moss/wheat），无蓝紫，像素 CRT 扫描线质感

## 已完成功能 / Completed Features

### 账号系统（模拟 Cloudflare Workers + D1 + Email Send）
- 邮箱注册 + 密码 PBKDF2 哈希 + 签名 session cookie
- 6 位验证码，15 分钟有效，存入 VerificationCode 表
- 邮件发送抽象层 `src/lib/email.ts`：沙箱环境写入 DevMail 表（开发邮箱面板可查），生产环境对接 CF Email Send（代码注释已标注）
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
- 视觉：暖色 sepia 天空渐变、远景城市剪影带亮窗、湿滑路面反光、路灯滚动、雨水粒子、撑伞顶部伞面+伞骨+水花、车把第一人称、背包带、伤害闪屏、屏幕震动、漂浮伤害文字

### 前端 UI `src/components/game/`
- `AuthPanel.tsx` 注册/登录 Tab，像素风表单
- `VerifyPanel.tsx` 验证码输入，自动检测开发邮箱验证码一键填入
- `DevMailbox.tsx` 开发邮箱面板（轮询、展开邮件正文、清空）
- `Leaderboard.tsx` 排行榜（前 20，前三名带皇冠/奖牌图标）
- `PixelRideGame.tsx` 游戏主体：canvas + HUD（HP/人品条、速度/时间/距离、分数+连击、伞状态、雨量、拖延、同学距离条）+ 事件日志 + 开始/暂停/结束遮罩 + 移动端虚拟按键 + 桌面端键位提示
- `page.tsx` 编排：header（logo + 玩法 + 用户状态 + 登出）/ 主区（认证态切换 game/auth/verify 三屏）/ sticky footer

### 验证结果 / Verification
- agent-browser 全流程跑通：注册→验证码（开发邮箱 147079）→验证→进入游戏→开始骑行→游戏结束→提交成绩→排行榜更新
- VLM 确认渲染：第一人称骑车视角、暖色调无蓝紫、HUD 完整、无渲染 glitch
- 移动端 390×844 响应式正常，footer sticky
- lint 0 errors

## 未解决问题 / 风险 / 下一步

### 已知小问题
1. agent-browser 的 `click` 命令对 shadcn Button 的 onClick 触发不稳定（需 `.click()` via eval）—— 这是测试工具特性，真实用户点击正常
2. Prisma 查询日志已降为 error/warn 级别
3. 游戏默认撑伞开局，新手可能不知道按空格收伞加速甩同学 —— 玩法说明已写明

### 下一阶段建议（cron 任务可推进）
- **新功能**: 每日挑战 / 道具商店（用分数兑换：雨衣、车铃、加速水） / 成就系统 / 好友对战
- **新机制**: 路面类型变化（减速带、下坡加速、逆风）、Boss 同学（不同速度的追赶者）、昼夜循环
- **样式细化**: 像素字体按钮 hover 动画、过场动画、角色选择（不同自行车外观）、关卡场景切换（校园/公园/闹市）
- **音效**: Web Audio 合成 8-bit 音效（车铃、碰撞、雨声、心跳警告）
- **CF 部署**: 编写 wrangler.toml + D1 schema 迁移 + Email Send 绑定，真正部署到 Cloudflare
- **排行榜优化**: 分页、按距离/时间维度排序、个人最佳高亮、反作弊阈值

### 架构备注
当前用 Prisma/SQLite 替代 D1，`src/lib/email.ts` 已抽象邮件发送接口，切到 CF 时只需替换 `sendEmail` 实现为 `env.MAILER.send(...)`，schema 可直接迁移到 D1。Session 用 HMAC 签名 cookie，无服务端存储，天然适配 Workers 无状态特性。
