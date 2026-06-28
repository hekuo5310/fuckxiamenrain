import { getEnv } from '@/lib/cloudflare'

// 邮件发送服务——只用 Cloudflare Email Send。
//
// 调用方式：
//   await env.MAILER.send({ from, to, subject, text, html })
//
// 这是 CF Workers 2024 年起提供的对象式 API，由 @cloudflare/workers-types 原生支持。
// 不需要 import cloudflare:email，也不需要 unsafe.eval。
//
// 本地 dev（wrangler dev）下 miniflare 的 send_email binding 是 stub，
// send 调用会成功但不真发信。开发时验证码可在 wrangler 终端日志看到（console.log）。

const FROM_FALLBACK = 'Pixel Ride <no-reply@pixelride.dev>'

interface SendEmailBuilder {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  headers?: Record<string, string>
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendEmail(opts: {
  toEmail: string
  subject: string
  body: string
}): Promise<void> {
  const env = await getEnv()
  const from = env.FROM_EMAIL || FROM_FALLBACK

  if (!env.MAILER) {
    console.warn('[mail] no MAILER binding, email not sent')
    return
  }

  const builder: SendEmailBuilder = {
    from,
    to: opts.toEmail,
    subject: opts.subject,
    text: opts.body,
    html: `<pre style="font:14px monospace;line-height:1.5;white-space:pre-wrap;">${escapeHtml(opts.body)}</pre>`,
  }

  try {
    await (env.MAILER as unknown as {
      send(b: SendEmailBuilder): Promise<unknown>
    }).send(builder)
    console.log(`[mail] sent to=${opts.toEmail} subject="${opts.subject}"`)
  } catch (err) {
    console.error('[mail] send failed:', err)
    throw err
  }
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function issueVerificationCode(
  email: string,
  purpose: string = 'register'
) {
  // 动态 import 避免循环依赖
  const { getPrisma } = await import('@/lib/db')
  const prisma = await getPrisma()

  await prisma.verificationCode.updateMany({
    where: { email, purpose, consumed: false },
    data: { consumed: true },
  })
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15)
  await prisma.verificationCode.create({
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

  await sendEmail({ toEmail: email, subject, body })
  return code
}
