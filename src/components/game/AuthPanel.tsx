'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail, KeyRound, User as UserIcon } from 'lucide-react'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  verified: boolean
}

interface Props {
  onAuthed: (u: AuthUser) => void
  onNeedVerify: (u: AuthUser) => void
}

export function AuthPanel({ onAuthed, onNeedVerify }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'login' | 'register'>('register')

  // register fields
  const [rEmail, setREmail] = useState('')
  const [rPass, setRPass] = useState('')
  const [rName, setRName] = useState('')
  const [loading, setLoading] = useState(false)

  // login fields
  const [lEmail, setLEmail] = useState('')
  const [lPass, setLPass] = useState('')

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rEmail, password: rPass, displayName: rName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      toast({
        title: '注册成功',
        description: '验证码已发送到你的邮箱，请查收并输入验证码完成验证。',
      })
      onNeedVerify(data.user)
    } catch (err: any) {
      toast({ title: '注册失败', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lEmail, password: lPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      toast({ title: '登录成功', description: `欢迎回来，${data.user.displayName}` })
      if (!data.user.verified) onNeedVerify(data.user)
      else onAuthed(data.user)
    } catch (err: any) {
      toast({ title: '登录失败', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="pixel-border bg-card p-5">
        <div className="mb-4 text-center">
          <h2 className="font-pixel text-sm text-primary">骑手通行证</h2>
          <p className="font-vt text-base text-muted-foreground mt-1">RIDER LICENSE</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full pixel-border-sm rounded-none bg-secondary h-auto">
            <TabsTrigger value="register" className="font-pixel text-[10px] rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              注册
            </TabsTrigger>
            <TabsTrigger value="login" className="font-pixel text-[10px] rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              登录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={submitRegister} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="rname" className="font-vt text-base">昵称 / Display Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="rname"
                    value={rName}
                    onChange={(e) => setRName(e.target.value)}
                    placeholder="校园骑手"
                    className="font-vt text-base pl-8 pixel-border-sm rounded-none bg-background"
                    maxLength={16}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="remail" className="font-vt text-base">邮箱 / Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="remail"
                    type="email"
                    required
                    value={rEmail}
                    onChange={(e) => setREmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="font-vt text-base pl-8 pixel-border-sm rounded-none bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rpass" className="font-vt text-base">密码 / Password (≥6)</Label>
                <div className="relative">
                  <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="rpass"
                    type="password"
                    required
                    value={rPass}
                    onChange={(e) => setRPass(e.target.value)}
                    placeholder="••••••"
                    className="font-vt text-base pl-8 pixel-border-sm rounded-none bg-background"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full pixel-btn rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-auto py-3 font-pixel text-[10px]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '注册并发送验证码'}
              </Button>
              <p className="font-vt text-sm text-muted-foreground text-center leading-tight">
                注册后将通过 Cloudflare Email Send 发送验证码到你的邮箱。
              </p>
            </form>
          </TabsContent>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={submitLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="lemail" className="font-vt text-base">邮箱 / Email</Label>
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="lemail"
                    type="email"
                    required
                    value={lEmail}
                    onChange={(e) => setLEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="font-vt text-base pl-8 pixel-border-sm rounded-none bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="lpass" className="font-vt text-base">密码 / Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="lpass"
                    type="password"
                    required
                    value={lPass}
                    onChange={(e) => setLPass(e.target.value)}
                    placeholder="••••••"
                    className="font-vt text-base pl-8 pixel-border-sm rounded-none bg-background"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full pixel-btn rounded-none bg-accent text-accent-foreground hover:bg-accent/90 h-auto py-3 font-pixel text-[10px]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '登录'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
