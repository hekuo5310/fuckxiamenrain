import { db } from '@/lib/db'

/**
 * Email sending service.
 *
 * In production on Cloudflare Workers this would call the native
 * `send_email` binding (MailChannels / Email Routing) configured in
 * `wrangler.toml`. e.g.:
 *
 *   await env.MAILER.send({
 *     from: "Pixel Ride <no-reply@pixelride.dev>",
 *     to: email,
 *     subject,
 *     text: body,
 *   })
 *
 * In this sandbox we cannot reach a real SMTP gateway, so we persist
 * the message into the `DevMail` table (a KV-like mailbox) that the
 * player can read in-app via the "Dev Mailbox" panel. This keeps the
 * auth + verification flow fully functional end-to-end.
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
