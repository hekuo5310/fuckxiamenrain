'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Trophy, Crown, Medal, Loader2 } from 'lucide-react'

interface Row {
  rank: number
  id: string
  score: number
  distance: number
  survivalMs: number
  maxHp: number
  finalRep: number
  umbrellaMs: number
  crashes: number
  createdAt: string
  displayName: string
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${m}m`
}

const rankIcon = (r: number) => {
  if (r === 1) return <Crown className="w-3 h-3 text-d9a441" style={{ color: '#d9a441' }} />
  if (r === 2) return <Medal className="w-3 h-3" style={{ color: '#a3a3a3' }} />
  if (r === 3) return <Medal className="w-3 h-3" style={{ color: '#c1440e' }} />
  return null
}

export function Leaderboard({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(() => true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const r = await fetch('/api/leaderboard?limit=20')
        const d = await r.json()
        if (cancelled) return
        setRows(d.leaderboard || [])
      } catch {
        if (!cancelled) toast({ title: '加载排行榜失败', variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [refreshKey, toast])

  return (
    <div className="pixel-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="font-pixel text-[11px] text-primary">排行榜</h3>
        <span className="font-vt text-xs text-muted-foreground ml-auto">LEADERBOARD</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="font-vt text-sm text-muted-foreground text-center py-8">
          暂无成绩，成为第一个上榜的骑手！
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`flex items-center gap-2 px-2 py-1.5 pixel-border-sm bg-background ${
                r.rank <= 3 ? 'bg-secondary' : ''
              }`}
            >
              <span className="font-pixel text-[10px] w-6 text-center text-primary">
                {rankIcon(r.rank) || `#${r.rank}`}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-vt text-sm text-foreground truncate leading-tight">
                  {r.displayName}
                </div>
                <div className="font-vt text-[10px] text-muted-foreground leading-tight">
                  {fmtDist(r.distance)} · {fmtTime(r.survivalMs)} · 撞{r.crashes}次
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-pixel text-[11px] text-primary">{r.score.toLocaleString()}</div>
                <div className="font-vt text-[10px] text-muted-foreground">分</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
