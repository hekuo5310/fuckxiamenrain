'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Heart, Shield, Gauge, Timer, Route, Umbrella,
  Play, Pause, RotateCcw, Trophy, Send, AlertTriangle, Coffee,
} from 'lucide-react'
import { Game, type GameStats, type GameEvent, type GameResult, type GamePhase } from '@/lib/game/engine'

interface Props {
  user: { id: string; email: string; displayName: string; verified: boolean } | null
  onScoreSubmitted: () => void
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${m}m`
}

const emptyStats: GameStats = {
  hp: 100, maxHp: 100, reputation: 100, distance: 0, survivalMs: 0, delayMs: 0,
  umbrellaOn: true, umbrellaMs: 0, speed: 0, speedKmh: 0, classmateDist: 0.55,
  crashes: 0, phase: 'ready', rainIntensity: 0.4, score: 0, combo: 0,
}

export function PixelRideGame({ user, onScoreSubmitted }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<Game | null>(null)
  const [stats, setStats] = useState<GameStats>(emptyStats)
  const [phase, setPhase] = useState<GamePhase>('ready')
  const [events, setEvents] = useState<GameEvent[]>([])
  const [result, setResult] = useState<GameResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { toast } = useToast()

  // recent events buffer (keep last 4)
  const pushEvent = useCallback((e: GameEvent) => {
    setEvents((prev) => [...prev.slice(-3), e])
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    const game = new Game(canvasRef.current, {
      onStats: setStats,
      onEvent: (e) => {
        pushEvent(e)
        if (e.tone === 'bad') {
          toast({ title: e.text, variant: e.type === 'caught' ? 'destructive' : 'default' })
        }
      },
      onGameOver: (r) => setResult(r),
      onPhaseChange: (p) => setPhase(p),
    })
    gameRef.current = game
    game.init()
    return () => game.destroy()
  }, [])

  function handleStart() {
    setResult(null)
    setSubmitted(false)
    setEvents([])
    gameRef.current?.start()
  }

  function handlePauseToggle() {
    // engine listens to 'p' key, but also expose via virtual
    gameRef.current?.setVirtualInput('pause', true)
  }

  async function handleSubmitScore() {
    if (!result) return
    if (!user || !user.verified) {
      toast({ title: '请先注册并验证邮箱再提交成绩', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: result.score,
          distance: result.distance,
          survivalMs: result.survivalMs,
          maxHp: result.maxHp,
          finalRep: result.finalRep,
          umbrellaMs: result.umbrellaMs,
          crashes: result.crashes,
          displayName: user.displayName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交失败')
      toast({ title: '成绩已上榜！', description: `得分 ${result.score.toLocaleString()}` })
      setSubmitted(true)
      onScoreSubmitted()
    } catch (err: any) {
      toast({ title: '提交失败', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const danger = 1 - stats.classmateDist
  const rainPct = Math.round(stats.rainIntensity * 100)

  return (
    <div className="w-full">
      {/* Canvas + overlays */}
      <div className="relative w-full pixel-border bg-[#1a1410] scanlines" style={{ aspectRatio: '16 / 10' }}>
        <canvas
          ref={canvasRef}
          className="pixelated absolute inset-0 w-full h-full"
        />

        {/* Top HUD bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-2 flex items-start justify-between gap-2 pointer-events-none">
          {/* Left: HP + Rep */}
          <div className="flex flex-col gap-1 min-w-[120px] max-w-[45%]">
            <Bar
              icon={<Heart className="w-3 h-3" />}
              value={stats.hp}
              max={stats.maxHp}
              color="#b23a2e"
              label="HP"
            />
            <Bar
              icon={<Shield className="w-3 h-3" />}
              value={stats.reputation}
              max={100}
              color="#6f8f4f"
              label="人品"
            />
          </div>
          {/* Right: speed / time / dist */}
          <div className="flex flex-col gap-1 items-end min-w-[120px] max-w-[45%]">
            <Pill icon={<Gauge className="w-3 h-3" />}>{stats.speedKmh} km/h</Pill>
            <Pill icon={<Timer className="w-3 h-3" />}>{fmtTime(stats.survivalMs)}</Pill>
            <Pill icon={<Route className="w-3 h-3" />}>{fmtDist(stats.distance)}</Pill>
          </div>
        </div>

        {/* Center top: score + combo */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="font-pixel text-[10px] text-[#f3e9d2] text-center drop-shadow-[2px_2px_0_#2b2118]">
            {stats.score.toLocaleString()}
          </div>
          {stats.combo > 0 && (
            <div className="font-pixel text-[8px] text-[#d9a441] text-center mt-0.5 drop-shadow-[1px_1px_0_#2b2118]">
              x{stats.combo} COMBO
            </div>
          )}
        </div>

        {/* Umbrella + rain indicator bottom-left */}
        <div className="absolute bottom-2 left-2 z-20 flex flex-col gap-1 pointer-events-none">
          <div
            className={`pixel-border-sm px-1.5 py-0.5 font-pixel text-[8px] flex items-center gap-1 ${
              stats.umbrellaOn ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
            }`}
          >
            <Umbrella className="w-2.5 h-2.5" />
            {stats.umbrellaOn ? '伞·开' : '伞·收'}
          </div>
          <div className="pixel-border-sm px-1.5 py-0.5 font-vt text-xs bg-background/80 text-foreground flex items-center gap-1">
            <span className="inline-block w-2 h-2" style={{ background: rainPct > 60 ? '#b23a2e' : rainPct > 35 ? '#d9a441' : '#6f8f4f' }} />
            雨 {rainPct}%
          </div>
          {stats.delayMs > 0 && (
            <div className="pixel-border-sm px-1.5 py-0.5 font-vt text-xs bg-background/80 text-[#b23a2e] flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              拖延 +{Math.round(stats.delayMs / 1000)}s
            </div>
          )}
        </div>

        {/* Classmate danger meter bottom-right */}
        <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
          <div className="pixel-border-sm bg-background/80 p-1 w-20">
            <div className="font-vt text-[10px] text-foreground mb-0.5 text-center">同学距离</div>
            <div className="h-2 bg-[#2b2118] relative pixel-border-sm">
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${Math.round(stats.classmateDist * 100)}%`,
                  background: danger > 0.6 ? '#b23a2e' : danger > 0.35 ? '#d9a441' : '#6f8f4f',
                }}
              />
            </div>
          </div>
        </div>

        {/* Event log */}
        {events.length > 0 && phase === 'playing' && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 pointer-events-none max-w-[80%]">
            {events.map((e, i) => (
              <div
                key={i}
                className={`font-vt text-xs px-2 py-0.5 pixel-border-sm bg-background/90 ${
                  e.tone === 'bad' ? 'text-[#b23a2e]' : e.tone === 'good' ? 'text-[#6f8f4f]' : e.tone === 'warn' ? 'text-[#d9a441]' : 'text-foreground'
                }`}
                style={{ opacity: 1 - (events.length - 1 - i) * 0.2 }}
              >
                {e.text}
              </div>
            ))}
          </div>
        )}

        {/* Ready overlay */}
        {phase === 'ready' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-4">
            <h2 className="font-pixel text-sm text-[#f3e9d2] mb-2 drop-shadow-[2px_2px_0_#2b2118]">
              雨中骑车上学路
            </h2>
            <p className="font-vt text-sm text-[#e6d3a3] mb-4 max-w-xs leading-tight">
              撑伞慢行保命值 / 收伞狂飙甩同学<br />
              躲蜗牛、避行人、别被水坑溅一身
            </p>
            <Button
              onClick={handleStart}
              className="pixel-btn rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-auto py-3 px-6 font-pixel text-[10px]"
            >
              <Play className="w-3 h-3 mr-1" /> 开始骑行
            </Button>
            <p className="font-vt text-[10px] text-[#b9a888] mt-4 leading-tight">
              ←/A →/D 变道 · ↑/W 踩踏 · ↓/S 刹车 · 空格 撑伞 · P 暂停
            </p>
          </div>
        )}

        {/* Paused overlay */}
        {phase === 'paused' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-4">
            <h2 className="font-pixel text-sm text-[#f3e9d2] mb-3">已暂停</h2>
            <Button
              onClick={handlePauseToggle}
              className="pixel-btn rounded-none bg-accent text-accent-foreground h-auto py-2 px-4 font-pixel text-[10px]"
            >
              <Play className="w-3 h-3 mr-1" /> 继续
            </Button>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'over' && result && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-4 overflow-y-auto">
            <h2 className="font-pixel text-sm text-[#b23a2e] mb-1 drop-shadow-[2px_2px_0_#2b2118]">骑行结束</h2>
            <p className="font-vt text-xs text-[#e6d3a3] mb-3">{result.reason}</p>
            <div className="grid grid-cols-2 gap-1.5 mb-3 w-full max-w-xs text-left">
              <Stat label="得分" value={result.score.toLocaleString()} highlight />
              <Stat label="距离" value={fmtDist(result.distance)} />
              <Stat label="存活" value={fmtTime(result.survivalMs)} />
              <Stat label="人品" value={String(result.finalRep)} />
              <Stat label="撑伞" value={fmtTime(result.umbrellaMs)} />
              <Stat label="碰撞" value={`${result.crashes} 次`} />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button
                onClick={handleStart}
                className="pixel-btn rounded-none bg-primary text-primary-foreground h-auto py-2 px-4 font-pixel text-[10px]"
              >
                <RotateCcw className="w-3 h-3 mr-1" /> 再来一次
              </Button>
              {user?.verified ? (
                <Button
                  onClick={handleSubmitScore}
                  disabled={submitting || submitted}
                  className="pixel-btn rounded-none bg-accent text-accent-foreground h-auto py-2 px-4 font-pixel text-[10px]"
                >
                  {submitted ? (
                    <><Trophy className="w-3 h-3 mr-1" /> 已上榜</>
                  ) : submitting ? (
                    '提交中…'
                  ) : (
                    <><Send className="w-3 h-3 mr-1" /> 提交成绩</>
                  )}
                </Button>
              ) : (
                <div className="font-vt text-xs text-[#d9a441] pixel-border-sm bg-background/80 px-2 py-2 max-w-[180px]">
                  {user ? '验证邮箱后可提交成绩' : '登录并验证邮箱后可提交成绩'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Virtual controls (touch) — always visible, useful on mobile */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
        <TouchBtn label="左" onPress={() => gameRef.current?.setVirtualInput('left', true)} />
        <TouchBtn label="伞" onPress={() => gameRef.current?.setVirtualInput('umbrella', true)} />
        <TouchBtn label="右" onPress={() => gameRef.current?.setVirtualInput('right', true)} />
        <HoldBtn label="踩" onDown={() => gameRef.current?.setVirtualInput('pedal', true)} onUp={() => gameRef.current?.setVirtualInput('pedal', false)} />
        <TouchBtn label="Ⅱ" onPress={() => gameRef.current?.setVirtualInput('pause', true)} />
        <HoldBtn label="刹" onDown={() => gameRef.current?.setVirtualInput('brake', true)} onUp={() => gameRef.current?.setVirtualInput('brake', false)} />
      </div>

      {/* Desktop control helper */}
      <div className="hidden sm:flex mt-3 flex-wrap gap-2 justify-center">
        <KeyCap k="← →" label="变道" />
        <KeyCap k="↑" label="踩踏加速" />
        <KeyCap k="↓" label="刹车" />
        <KeyCap k="空格" label="撑/收伞" />
        <KeyCap k="P" label="暂停" />
        <KeyCap k="Enter" label="开始/重玩" />
      </div>
    </div>
  )
}

function Bar({ icon, value, max, color, label }: { icon: React.ReactNode; value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="pixel-border-sm bg-background/90 p-1">
      <div className="flex items-center gap-1 mb-0.5">
        <span style={{ color }}>{icon}</span>
        <span className="font-pixel text-[7px] text-foreground">{label}</span>
        <span className="font-vt text-[10px] text-foreground ml-auto">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-[#2b2118] pixel-border-sm">
        <div className="h-full transition-all duration-200" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pixel-border-sm bg-background/90 px-1.5 py-0.5 font-vt text-xs text-foreground flex items-center gap-1">
      {icon}
      {children}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="pixel-border-sm bg-background/90 p-1.5">
      <div className="font-vt text-[10px] text-muted-foreground leading-tight">{label}</div>
      <div className={`font-pixel text-[10px] ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}

function TouchBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      className="pixel-btn bg-primary text-primary-foreground h-12 font-pixel text-[10px] active:translate-x-[3px] active:translate-y-[3px]"
    >
      {label}
    </button>
  )
}

function HoldBtn({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDown() }}
      onPointerUp={(e) => { e.preventDefault(); onUp() }}
      onPointerLeave={() => onUp()}
      className="pixel-btn bg-accent text-accent-foreground h-12 font-pixel text-[10px] active:translate-x-[3px] active:translate-y-[3px]"
    >
      {label}
    </button>
  )
}

function KeyCap({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="pixel-border-sm bg-secondary text-secondary-foreground font-pixel text-[9px] px-1.5 py-1 min-w-[28px] text-center">
        {k}
      </span>
      <span className="font-vt text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// silence unused import warnings for icons that may be tree-shaken
void Coffee
