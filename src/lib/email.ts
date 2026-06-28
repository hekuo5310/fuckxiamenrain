import { getEnv } from '@/lib/cloudflare'
import { getPrisma } from '@/lib/db'

// 邮件发送服务。
//
// 生产（Workers）：直接调用 CF Email Send 绑定的对象式 API：
//   await env.MAILER.send({ from, to, subject, text, html })
// 这是 Cloudflare Workers 2024 年起新增的便捷 API，不需要 import
// `cloudflare:email` 模块构造 EmailMessage，因此：
//   1. esbuild 不会因为解析不到 cloudflare:email 报错
//   2. Workers 不需要开 unsafe.eval 兼容性 flag
//   3. 代码在 dev / prod 完全一致
//
// 本地 dev：miniflare 的 send_email binding 是 stub，不会真发信。
// 我们在 dev 下绕过 binding，直接落 DevMail 表，可在「开发邮箱」面板查看。
//
// 类型参考 @cloudflare/workers-types 的 SendEmail 接口：
//   send(builder: {
//     from: string | EmailAddress
//     to: string | EmailAddress | (string | EmailAddress)[]
//     subject: string
//     replyTo?: ...
//     cc?: ...
//     bcc?: ...
//     headers?: Record<string, string>
//     text?: string
//     html?: string
//     attachments?: EmailAttachment[]
//   })

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
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function sendEmail(opts: {
  userId?: string | null
  toEmail: string
  subject: string
  body: string
}): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development'
  const env = await getEnv()
  const from = env.FROM_EMAIL || FROM_FALLBACK

  // dev：直接落 DevMail，跳过 CF 调用
  if (isDev) {
    return sendDevMail(opts)
  }

  // 生产：CF Email Send 对象式 API
  // 重要：无论 send 是否"成功"，都同步落一份到 DevMail 表。
  // 原因：wrangler.toml 的 destination_address 限制会让非目标地址的邮件
  // 被 CF 静默拒绝或抛错；destination_address 模式下邮件只发到固定地址，
  // 用户自己的邮箱根本收不到。落 DevMail 让用户总能从应用内
  // 「开发邮箱」面板读到验证码，避免卡在 verify 界面。
  if (env.MAILER) {
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
    } catch (err) {
      // send 抛错也要继续，确保 DevMail 落库
      console.error('[mail] send threw, will still save DevMail:', err)
    }
  } else {
    console.warn('[mail] no MAILER binding, only saving DevMail')
  }

  // 始终落一份到 DevMail，作为应用内可读的备份
  return sendDevMail(opts)

  async function sendDevMail(o: typeof opts) {
    const prisma = await getPrisma()
    await prisma.devMail.create({
      data: {
        userId: o.userId ?? null,
        toEmail: o.toEmail,
        subject: o.subject,
        body: o.body,
      },
    })
    console.log(`[mail] to=${o.toEmail} subject="${o.subject}"\n${o.body}\n---`)
  }
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
  const prisma = await getPrisma()
  // 作废该 email+purpose 之前未消费的验证码
  await prisma.verificationCode.updateMany({
    where: { email, purpose, consumed: false },
    data: { consumed: true },
  })
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15) // 15 分钟
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

  await sendEmail({ userId, toEmail: email, subject, body })
  return code
}
