'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Bike, LogOut, User as UserIcon, ShieldCheck, BookOpen, Github } from 'lucide-react'
import { AuthPanel, type AuthUser } from '@/components/game/AuthPanel'
import { VerifyPanel } from '@/components/game/VerifyPanel'
import { PixelRideGame } from '@/components/game/PixelRideGame'
import { Leaderboard } from '@/components/game/Leaderboard'

type Screen = 'loading' | 'auth' | 'verify' | 'game'

export default function Home() {
  const { toast } = useToast()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [screen, setScreen] = useState<Screen>('loading')
  const [lbKey, setLbKey] = useState(0)
  const [showHowto, setShowHowto] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user)
          setScreen(d.user.verified ? 'game' : 'verify')
        } else {
          setScreen('auth')
        }
      })
      .catch(() => setScreen('auth'))
  }, [])

  const onAuthed = useCallback((u: AuthUser) => {
    setUser(u)
    setScreen('game')
  }, [])

  const onNeedVerify = useCallback((u: AuthUser) => {
    setUser(u)
    setScreen('verify')
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setScreen('auth')
    toast({ title: '已退出登录' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* HEADER */}
      <header className="pixel-border-x-0 border-b-[3px] border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary pixel-border-sm flex items-center justify-center">
              <Bike className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-none">
              <h1 className="font-pixel text-[11px] text-primary">PIXEL RIDE</h1>
              <p className="font-vt text-xs text-muted-foreground">雨中骑车上学路</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="font-vt text-sm h-8"
              onClick={() => setShowHowto((s) => !s)}
            >
              <BookOpen className="w-3 h-3 mr-1" /> 玩法
            </Button>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="pixel-border-sm bg-secondary px-2 py-1 flex items-center gap-1.5">
                  <UserIcon className="w-3 h-3 text-primary" />
                  <span className="font-vt text-sm text-foreground max-w-[100px] truncate">{user.displayName}</span>
                  {user.verified ? (
                    <ShieldCheck className="w-3 h-3 text-accent" />
                  ) : (
                    <span className="font-vt text-[10px] text-[#d9a441]">未验证</span>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} title="退出">
                  <LogOut className="w-3 h-3" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-4">
        {screen === 'loading' && (
          <div className="flex items-center justify-center py-32">
            <div className="font-pixel text-[10px] text-muted-foreground animate-pulse">LOADING...</div>
          </div>
        )}

        {screen === 'auth' && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
            <div className="hidden lg:block">
              <Hero />
              <HowToPlay />
            </div>
            <div className="flex justify-center lg:justify-start">
              <AuthPanel onAuthed={onAuthed} onNeedVerify={onNeedVerify} />
            </div>
            <div className="lg:hidden">
              <HowToPlay />
            </div>
          </div>
        )}

        {screen === 'verify' && user && (
          <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
            <div className="flex justify-center lg:justify-start">
              <VerifyPanel user={user} onVerified={onAuthed} />
            </div>
          </div>
        )}

        {screen === 'game' && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            <div>
              <PixelRideGame user={user} onScoreSubmitted={() => setLbKey((k) => k + 1)} />
            </div>
            <div className="space-y-3">
              <Leaderboard refreshKey={lbKey} />
            </div>
          </div>
        )}

        {showHowto && (
          <div className="mt-4">
            <HowToPlay />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t-[3px] border-border bg-card mt-auto">
        <div className="max-w-6xl mx-auto px-3 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-vt text-xs text-muted-foreground text-center sm:text-left leading-tight">
            像素风 · 第一人称 · 撑伞骑车 · Cloudflare Workers + D1/KV + Email Send
          </div>
          <div className="flex items-center gap-3">
            <span className="font-vt text-[10px] text-muted-foreground">© Pixel Ride</span>
            <Github className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>
      </footer>
    </div>
  )
}

function Hero() {
  return (
    <div className="pixel-border bg-card p-5">
      <h2 className="font-pixel text-sm text-primary mb-2">雨中骑车上学路</h2>
      <p className="font-vt text-base text-foreground leading-snug mb-3">
        清晨下雨了，可你还得骑车去上学。一手撑伞，一手扶把，
        蜗牛在路面慢吞吞地爬，行人在斑马线上踱步，水坑一个接一个。
        最糟的是——迟到的同学正在后面猛追，想抄你的车把！
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Feature title="撑伞系统" desc="撑伞速度 -20%，但生命值保持得更好，水坑溅水大幅减免。" />
        <Feature title="同学追逐" desc="保持高速才能甩开同学，被追上直接结束。" />
        <Feature title="蜗牛与人品" desc="碾到蜗牛扣人品并拖延时间，请绕行。" />
        <Feature title="行人与冲突" desc="撞到行人可能被揍（扣血）或被骂（扣人品）。" />
      </div>
    </div>
  )
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="pixel-border-sm bg-background p-2">
      <div className="font-pixel text-[9px] text-primary mb-1">{title}</div>
      <div className="font-vt text-xs text-muted-foreground leading-tight">{desc}</div>
    </div>
  )
}

function HowToPlay() {
  return (
    <div className="pixel-border bg-card p-4 mt-4">
      <h3 className="font-pixel text-[11px] text-primary mb-3">玩法说明</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="font-pixel text-[9px] text-foreground mb-1">操作</div>
          <ul className="font-vt text-sm text-muted-foreground space-y-1 leading-tight">
            <li>← / → 或 A / D：左右变道</li>
            <li>↑ / W：踩踏加速（甩开同学）</li>
            <li>↓ / S：刹车减速</li>
            <li>空格：撑起 / 收起雨伞</li>
            <li>P：暂停 · Enter：开始 / 重玩</li>
          </ul>
        </div>
        <div>
          <div className="font-pixel text-[9px] text-foreground mb-1">规则</div>
          <ul className="font-vt text-sm text-muted-foreground space-y-1 leading-tight">
            <li>碾到蜗牛：-人品，+拖延</li>
            <li>撞到行人：50% 被揍 -HP / 50% 被骂 -人品</li>
            <li>水坑溅水：伤害 = 速度 × 水深</li>
            <li>撑伞：速度 -20%，水坑伤害 -75%</li>
            <li>被同学追上：游戏结束</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
