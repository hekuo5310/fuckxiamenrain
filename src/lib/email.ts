import { getEnv } from '@/lib/cloudflare'
import { devMail, verificationCode } from '@/lib/db'

// 邮件发送服务。
// 生产：直接调用 CF Email Send 绑定 env.MAILER.send(EmailMessage)，
//       MIME 由 mimetext 构造（需装 mimetext 依赖）。
// 本地 dev：miniflare 不实际发信，验证码落 DevMail 表，可在「开发邮箱」面板查看，
//           保证注册 + 验证流程端到端可玩。

const FROM_FALLBACK = 'Pixel Ride <no-reply@pixelride.dev>'

export async function sendEmail(opts: {
  userId?: string | null
  toEmail: string
  subject: string
  body: string
}): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development'
  const env = getEnv()
  const from = env.FROM_EMAIL || FROM_FALLBACK

  if (!isDev && env.MAILER) {
    // 生产：CF Email Send 直接调用
    const { EmailMessage } = await import('cloudflare:email')
    const { createMimeMessage } = await import('mimetext')
    const msg = createMimeMessage()
    msg.setSender(from)
    msg.setRecipient(opts.toEmail)
    msg.setSubject(opts.subject)
    msg.addMessage({ contentType: 'text/plain', data: opts.body })
    await env.MAILER.send(new EmailMessage(from, opts.toEmail, msg))
    return
  }

  // dev fallback：落 DevMail 表
  await devMail.create({
    userId: opts.userId ?? null,
    toEmail: opts.toEmail,
    subject: opts.subject,
    body: opts.body,
  })
  console.log(
    `[mail] to=${opts.toEmail} subject="${opts.subject}"\n${opts.body}\n---`
  )
}

export function generateCode(): string {
  // 6 位数字验证码
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function issueVerificationCode(
  email: string,
  purpose: string = 'register',
  userId?: string | null
) {
  // 作废该 email+purpose 之前未消费的验证码
  await verificationCode.invalidateUnconsumed(email, purpose)
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString() // 15 分钟
  await verificationCode.create({ email, code, purpose, expiresAt })

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
