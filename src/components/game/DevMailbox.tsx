'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Mail, Trash2, RefreshCw, Inbox } from 'lucide-react'

interface Mail {
  id: string
  subject: string
  body: string
  toEmail: string
  createdAt: string
}

export function DevMailbox({ poll = true }: { poll?: boolean }) {
  const { toast } = useToast()
  const [mails, setMails] = useState<Mail[]>([])
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/devmail')
      const data = await res.json()
      setMails(data.mails || [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    run()
    if (poll) {
      const t = setInterval(() => { void load() }, 4000)
      return () => clearInterval(t)
    }
  }, [poll, load])

  async function clearAll() {
    await fetch('/api/devmail', { method: 'DELETE' })
    setMails([])
    toast({ title: '邮箱已清空' })
  }

  return (
    <div className="pixel-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          <h3 className="font-pixel text-[11px] text-primary">开发邮箱</h3>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} title="刷新">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAll} title="清空">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <p className="font-vt text-xs text-muted-foreground mb-3 leading-tight">
        模拟 Cloudflare Email Send 投递。生产环境会真实发到你的邮箱。
      </p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {mails.length === 0 ? (
          <div className="font-vt text-sm text-muted-foreground text-center py-6 flex flex-col items-center gap-2">
            <Mail className="w-6 h-6 opacity-40" />
            暂无邮件
          </div>
        ) : (
          mails.map((m) => (
            <div key={m.id} className="pixel-border-sm bg-background p-2">
              <button
                className="w-full text-left"
                onClick={() => setOpen(open === m.id ? null : m.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-vt text-sm text-foreground truncate">{m.subject}</span>
                  <span className="font-vt text-[10px] text-muted-foreground shrink-0">
                    {new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
              {open === m.id && (
                <pre className="font-vt text-xs text-foreground whitespace-pre-wrap mt-2 border-t border-border pt-2 max-h-48 overflow-y-auto">
                  {m.body}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
