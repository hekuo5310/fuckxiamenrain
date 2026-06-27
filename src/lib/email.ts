import { db } from '@/lib/db'

/**
 * 邮件发送服务。
 *
 * 生产环境在 Cloudflare Workers 上应调用原生 `send_email` 绑定
 * （MailChannels / Email Routing，在 wrangler.toml 配置）。例如：
 *
 *   await env.MAILER.send({
 *     from: "Pixel Ride <no-reply@pixelride.dev>",
 *     to: email,
 *     subject,
 *     text: body,
 *   })
 *
 * 沙箱环境无法连真实 SMTP 网关，故把邮件落库到 `DevMail` 表
 * （类似 KV 的邮箱），玩家可在应用内「开发邮箱」面板查看。
 * 这样注册 + 验证流程可端到端完整跑通。
 */

const FROM = 'Pixel Ride <no-reply@pixelride.dev>'

export async function sendEmail(opts: {
  userId?: string
  toEmail: string
  subject: string
  body: string
}): Promise<void> {
  await db.devMail.create({
    data: {
      userId: opts.userId ?? null,
      toEmail: opts.toEmail,
      subject: opts.subject,
      body: opts.body,
    },
  })

  // Also surface to dev server log so the operator can grab the code quickly.
  console.log(
    `[mail] to=${opts.toEmail} subject="${opts.subject}"\n${opts.body}\n---`
  )
}

export function generateCode(): string {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function issueVerificationCode(email: string, purpose: string = 'register', userId?: string) {
  // Invalidate previous unconsumed codes for this email+purpose
  await db.verificationCode.updateMany({
    where: { email, purpose, consumed: false },
    data: { consumed: true },
  })
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15) // 15 min
  await db.verificationCode.create({
    data: { email, code, purpose, expiresAt },
  })

  const subject =
    purpose === 'register'
      ? '[Pixel Ride] 注册验证码 / Registration Code'
      : '[Pixel Ride] 密码重置验证码 / Reset Code'
  const body = [
    `你好，${email}`,
    '',
    '欢迎来到「雨中骑车上学路 Pixel Ride」！',
    '',
    `你的验证码是：${code}`,
    '',
    '验证码 15 分钟内有效。如果不是你本人操作，请忽略此邮件。',
    '',
    '---',
    'Hello from Pixel Ride!',
    `Your verification code is: ${code}`,
    'It expires in 15 minutes. If this was not you, please ignore this email.',
    '',
    '- Pixel Ride Team',
  ].join('\n')

  await sendEmail({ userId, toEmail: email, subject, body })
  return code
}
