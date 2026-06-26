'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, RefreshCw, ShieldCheck, MailOpen } from 'lucide-react'
import type { AuthUser } from './AuthPanel'

interface Props {
  user: AuthUser
  onVerified: (u: AuthUser) => void
}

export function VerifyPanel({ user, onVerified }: Props) {
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [latestCode, setLatestCode] = useState<string | null>(null)

  // pull the latest mail so the user can autofill with one click (dev convenience)
  const fetchLatestMail = useCallback(async () => {
    try {
      const res = await fetch('/api/devmail')
      const data = await res.json()
      const latest = data.mails?.[0]
      if (latest) {
        const m = latest.body.match(/(\d{6})/)
        if (m) setLatestCode(m[1])
      } else {
        setLatestCode(null)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const run = async () => { await fetchLatestMail() }
    run()
    const t = setInterval(() => { void fetchLatestMail() }, 3000)
    return () => clearInterval(t)
  }, [fetchLatestMail])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '验证失败')
      toast({ title: '验证成功', description: '现在可以提交成绩到排行榜了！' })
      onVerified({ ...user, verified: true })
    } catch (err: any) {
      toast({ title: '验证失败', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setResending(true)
    try {
      await fetch('/api/auth/login', { method: 'PUT' })
      toast({ title: '已重新发送验证码' })
      setTimeout(fetchLatestMail, 500)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="pixel-border bg-card p-5 w-full max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <h2 className="font-pixel text-sm text-primary">邮箱验证</h2>
      </div>
      <p className="font-vt text-base text-muted-foreground mb-4 leading-tight">
        我们已向 <span className="text-foreground font-bold">{user.email}</span> 发送 6 位验证码。<br />
        验证码 15 分钟内有效。
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="code" className="font-vt text-base">验证码 / Code</Label>
          <Input
            id="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="------"
            className="font-pixel text-lg tracking-[0.4em] text-center pixel-border-sm rounded-none bg-background"
          />
        </div>
        {latestCode && (
          <button
            type="button"
            onClick={() => setCode(latestCode)}
            className="font-vt text-sm text-accent underline flex items-center gap-1"
          >
            <MailOpen className="w-3 h-3" /> 检测到开发邮箱验证码 {latestCode}（点击填入）
          </button>
        )}
        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full pixel-btn rounded-none bg-accent text-accent-foreground hover:bg-accent/90 h-auto py-3 font-pixel text-[10px]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '完成验证'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={resend}
          disabled={resending}
          className="w-full font-vt text-sm h-auto py-2"
        >
          {resending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          重新发送验证码
        </Button>
      </form>
    </div>
  )
}
