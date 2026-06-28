/*
 * Pixel Ride — game engine.
 * Pure TypeScript, no React. Renders a first-person bicycle ride through
 * a rainy sepia-toned street. The player dodges snails, pedestrians and
 * puddles while holding an umbrella and outrunning a chasing classmate.
 *
 * Render resolution is low (320x200) and scaled up with `imageSmoothingEnabled=false`
 * to produce crisp pixel art. Everything is drawn with integer rects.
 */

export type GamePhase = 'ready' | 'playing' | 'paused' | 'over'

export interface GameStats {
  hp: number
  maxHp: number
  reputation: number
  distance: number // meters
  survivalMs: number
  delayMs: number // accumulated delay
  umbrellaOn: boolean
  umbrellaMs: number
  speed: number // 0..1 normalized
  speedKmh: number
  classmateDist: number // 0..1 (1 = far/safe, 0 = caught)
  crashes: number
  phase: GamePhase
  rainIntensity: number // 0..1
  score: number
  combo: number
}

export interface GameEvent {
  type:
    | 'snail'
    | 'pedestrian_punch'
    | 'pedestrian_scold'
    | 'puddle_splash'
    | 'puddle_blocked'
    | 'umbrella_on'
    | 'umbrella_off'
    | 'classmate_close'
    | 'caught'
    | 'pickup'
    | 'info'
  text: string
  tone: 'bad' | 'good' | 'warn' | 'info'
  lane?: number
}

export interface GameResult {
  score: number
  distance: number
  survivalMs: number
  maxHp: number
  finalRep: number
  umbrellaMs: number
  crashes: number
  reason: string
}

export interface GameCallbacks {
  onStats: (s: GameStats) => void
  onEvent: (e: GameEvent) => void
  onGameOver: (r: GameResult) => void
  onPhaseChange: (p: GamePhase) => void
}

const W = 320
const H = 200
const HORIZON = 70
const GROUND_Y = H - 8
const CENTER_X = W / 2
const LANE_NEAR_SPREAD = 46 // pixel half-width of outer lane at z=0
const PERSP_K = 0.022 // perspective compression

type Lane = -1 | 0 | 1

interface Entity {
  id: number
  type: 'snail' | 'pedestrian' | 'puddle' | 'coin'
  lane: Lane
  z: number // 0 = at player, larger = farther
  // pedestrian crossing
  fromLane: Lane
  toLane: Lane
  crossT: number // 0..1 progress across road
  // puddle
  depth: number // 0..1
  width: number // lane fraction 0.5..1
  // visual seed
  seed: number
  // animation
  frame: number
  // state
  dead?: boolean
  hit?: boolean
}

interface Raindrop {
  x: number
  y: number
  len: number
  speed: number
}

interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
  vy: number
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
const choice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function laneOffsetX(lane: Lane, scale: number): number {
  return lane * LANE_NEAR_SPREAD * scale
}

function projectZ(z: number): number {
  return 1 / (1 + z * PERSP_K)
}

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cb: GameCallbacks
  private raf = 0
  private lastT = 0
  private acc = 0

  phase: GamePhase = 'ready'

  // player
  private lane: Lane = 0
  private laneX: number = 0 // smoothed lane position (-1..1)
  private umbrella: boolean = true // start with umbrella up (core mechanic)
  private pedaling: boolean = false
  private braking: boolean = false
  private speed: number = 0.55 // 0..1 normalized; ~1 = max
  private readonly baseCruise = 0.55
  private readonly maxSpeed = 1.0
  private readonly minSpeed = 0.25
  // 同学追逐阈值：速度高于此值拉开同学，低于此值被追近。
  // 必须低于 baseCruise * umbrellaPenalty (= 0.55 * 0.85 = 0.47)，
  // 否则撑伞巡航也会被追上——那是 bug。
  private readonly classmateThreshold = 0.35

  // stats
  private hp: number = 100
  private maxHp: number = 100
  private reputation: number = 100
  private distance: number = 0 // meters
  private survivalMs: number = 0
  private delayMs: number = 0
  private umbrellaMs: number = 0
  private crashes: number = 0
  private classmateDist: number = 0.55 // 0..1, 1=far safe, 0=caught
  private combo: number = 0
  private comboTimer: number = 0
  private rainIntensity: number = 0.45
  private rainTarget: number = 0.45
  private rainTimer: number = 0

  // world
  private entities: Entity[] = []
  private nextId = 1
  private spawnTimer = 0
  private roadScroll = 0
  private raindrops: Raindrop[] = []
  private floats: FloatText[] = []
  private elapsed = 0
  private invuln = 0 // ms of invulnerability after a hit
  private dmgFlash = 0
  private screenShake = 0
  private umbrellaBob = 0
  private pedestrianFrame = 0
  private frameCount = 0

  // input
  private keys: Record<string, boolean> = {}

  // bound handlers
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas
    this.canvas.width = W
    this.canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D not supported')
    this.ctx = ctx
    this.ctx.imageSmoothingEnabled = false
    this.cb = cb

    // init rain
    for (let i = 0; i < 70; i++) {
      this.raindrops.push({
        x: rand(0, W),
        y: rand(0, H),
        len: rand(4, 9),
        speed: rand(120, 200),
      })
    }

    this.boundKeyDown = (e) => this.onKey(e, true)
    this.boundKeyUp = (e) => this.onKey(e, false)
    window.addEventListener('keydown', this.boundKeyDown)
    window.addEventListener('keyup', this.boundKeyUp)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.boundKeyDown)
    window.removeEventListener('keyup', this.boundKeyUp)
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    // 优先用 e.code（物理键位），fallback 到 e.key。
    // 某些 IME / 键盘布局下 e.key 可能给出非预期字符，
    // 但 e.code 对方向键和空格始终稳定（ArrowLeft / ArrowRight / Space 等）。
    const code = (e.code || '').toLowerCase()
    const key = (e.key || '').toLowerCase()
    const map: Record<string, string> = {
      arrowleft: 'arrowleft', arrowright: 'arrowright',
      arrowup: 'arrowup', arrowdown: 'arrowdown',
      keya: 'a', keyd: 'd', keyw: 'w', keys: 's',
      space: ' ', keyp: 'p', enter: 'enter',
    }
    // 用 code 解析出统一 token，再用 key 兜底
    const k = map[code] || (['arrowleft','arrowright','arrowup','arrowdown','a','d','w','s',' ','p','enter'].includes(key) ? key : '')
    if (!k) return
    e.preventDefault()
    this.keys[k] = down
    if (down) this.handleAction(k)
    else {
      if (k === 'arrowup' || k === 'w') this.pedaling = false
      if (k === 'arrowdown' || k === 's') this.braking = false
    }
  }

  // touch / virtual buttons call this
  setVirtualInput(name: 'left' | 'right' | 'pedal' | 'brake' | 'umbrella' | 'pause' | 'start', pressed: boolean) {
    if (name === 'umbrella' && pressed) this.toggleUmbrella()
    else if (name === 'pause' && pressed) this.togglePause()
    else if (name === 'start' && pressed) this.start()
    else if (name === 'pedal') this.pedaling = pressed
    else if (name === 'brake') this.braking = pressed
    else if (name === 'left' && pressed) this.moveLane(-1)
    else if (name === 'right' && pressed) this.moveLane(1)
  }

  private handleAction(k: string) {
    if (k === 'arrowleft' || k === 'a') this.moveLane(-1)
    else if (k === 'arrowright' || k === 'd') this.moveLane(1)
    else if (k === ' ') this.toggleUmbrella()
    else if (k === 'p') this.togglePause()
    else if (k === 'enter') {
      if (this.phase === 'ready' || this.phase === 'over') this.start()
    }
    else if (k === 'arrowup' || k === 'w') this.pedaling = true
    else if (k === 'arrowdown' || k === 's') this.braking = true
  }

  private moveLane(dir: number) {
    if (this.phase !== 'playing') return
    const next = clamp(this.lane + dir, -1, 1) as Lane
    this.lane = next
  }

  private toggleUmbrella() {
    if (this.phase !== 'playing' && this.phase !== 'ready') return
    this.umbrella = !this.umbrella
    this.cb.onEvent({
      type: this.umbrella ? 'umbrella_on' : 'umbrella_off',
      text: this.umbrella ? '撑起雨伞 · 速度 -20%' : '收起雨伞 · 全速前进',
      tone: this.umbrella ? 'info' : 'info',
    })
  }

  private togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused'
      this.cb.onPhaseChange(this.phase)
    } else if (this.phase === 'paused') {
      this.phase = 'playing'
      this.lastT = performance.now()
      this.cb.onPhaseChange(this.phase)
    }
  }

  /**
   * Start the render loop in "ready" phase. Does NOT start gameplay.
   * The world renders behind the ready overlay so the player sees the scene.
   */
  init() {
    this.phase = 'ready'
    this.lastT = performance.now()
    this.emitStats()
    this.cb.onPhaseChange(this.phase)
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.loop)
  }

  start() {
    // reset
    this.lane = 0
    this.laneX = 0
    this.umbrella = true
    this.pedaling = false
    this.braking = false
    this.speed = this.baseCruise
    this.hp = 100
    this.maxHp = 100
    this.reputation = 100
    this.distance = 0
    this.survivalMs = 0
    this.delayMs = 0
    this.umbrellaMs = 0
    this.crashes = 0
    this.classmateDist = 0.55
    this.combo = 0
    this.comboTimer = 0
    this.rainIntensity = 0.4
    this.rainTarget = 0.4
    this.entities = []
    this.floats = []
    this.spawnTimer = 0
    this.elapsed = 0
    this.invuln = 0
    this.dmgFlash = 0
    this.screenShake = 0
    this.phase = 'playing'
    this.lastT = performance.now()
    this.cb.onPhaseChange(this.phase)
    this.emitStats()
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.phase = 'ready'
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop)
    let dt = (t - this.lastT) / 1000
    this.lastT = t
    if (dt > 0.1) dt = 0.1 // clamp big gaps
    if (this.phase === 'playing') {
      this.update(dt)
    }
    // always render so paused/over screens draw
    this.render()
  }

  private emitStats() {
    const score = this.computeScore()
    this.cb.onStats({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      reputation: Math.round(this.reputation),
      distance: Math.round(this.distance),
      survivalMs: Math.round(this.survivalMs),
      delayMs: Math.round(this.delayMs),
      umbrellaOn: this.umbrella,
      umbrellaMs: Math.round(this.umbrellaMs),
      speed: this.speed,
      speedKmh: Math.round(this.speed * 25 + 5),
      classmateDist: this.classmateDist,
      crashes: this.crashes,
      phase: this.phase,
      rainIntensity: this.rainIntensity,
      score,
      combo: this.combo,
    })
  }

  private computeScore(): number {
    const distScore = this.distance * 10
    const timeScore = this.survivalMs / 100
    const hpScore = this.hp * 5
    const repScore = Math.max(0, this.reputation) * 3
    const delayPenalty = this.delayMs / 50
    const comboBonus = this.combo * 25
    return Math.max(0, Math.round(distScore + timeScore + hpScore + repScore + comboBonus - delayPenalty))
  }

  private spawn() {
    // 最大同时存在实体数，防止路面上障碍物过密无法躲避
    if (this.entities.filter(e => !e.dead && e.z > 0).length >= 6) return

    const difficulty = clamp(this.elapsed / 90, 0, 1) // ramps over 90s
    const r = Math.random()
    let type: Entity['type']
    // 降低挡路障碍物(蜗牛+行人)总比例，提高水坑(可撑伞挡)和咖啡(拾取)
    if (r < 0.18) type = 'snail'
    else if (r < 0.36) type = 'pedestrian'
    else if (r < 0.80) type = 'puddle'
    else type = 'coin'

    const lane = choice([-1, 0, 1]) as Lane
    const z = rand(38, 48) // spawn far

    const e: Entity = {
      id: this.nextId++,
      type,
      lane,
      z,
      fromLane: lane,
      toLane: lane,
      crossT: 0,
      depth: 0,
      width: 1,
      seed: Math.random() * 1000,
      frame: randInt(0, 1),
    }

    if (type === 'pedestrian') {
      // walk across the road: from a side toward the other
      const side = Math.random() < 0.5 ? -1 : 1
      e.fromLane = side as Lane
      e.toLane = (-side) as Lane
      e.lane = e.fromLane
      e.crossT = 0
    } else if (type === 'puddle') {
      e.depth = rand(0.25, 1) * (0.6 + difficulty * 0.4)
      e.width = rand(0.6, 1)
    }

    this.entities.push(e)

    // 高难度时有概率额外刷一个（降低概率避免太密）
    if (difficulty > 0.6 && Math.random() < 0.12) {
      const lane2 = ([-1, 0, 1].filter((l) => l !== lane) as Lane[])[randInt(0, 1)]
      const t2 = choice(['snail', 'puddle']) as Entity['type']
      this.entities.push({
        id: this.nextId++,
        type: t2,
        lane: lane2,
        z: rand(38, 48),
        fromLane: lane2,
        toLane: lane2,
        crossT: 0,
        depth: t2 === 'puddle' ? rand(0.2, 0.8) : 0,
        width: t2 === 'puddle' ? rand(0.6, 1) : 1,
        seed: Math.random() * 1000,
        frame: randInt(0, 1),
      })
    }
  }

  private update(dt: number) {
    this.elapsed += dt
    this.survivalMs += dt * 1000

    // --- rain variation ---
    this.rainTimer -= dt
    if (this.rainTimer <= 0) {
      this.rainTarget = rand(0.2, 0.95)
      this.rainTimer = rand(8, 16)
    }
    this.rainIntensity += (this.rainTarget - this.rainIntensity) * dt * 0.5

    // --- input → speed ---
    const umbPenalty = this.umbrella ? 0.85 : 1.0
    const targetSpeed = this.braking
      ? this.minSpeed * 0.5
      : this.pedaling
      ? this.maxSpeed * umbPenalty
      : this.baseCruise * umbPenalty
    this.speed += (targetSpeed - this.speed) * dt * 2.5
    this.speed = clamp(this.speed, this.minSpeed * 0.4, this.maxSpeed)

    // --- lane smoothing ---
    this.laneX += (this.lane - this.laneX) * dt * 14

    // --- umbrella time ---
    if (this.umbrella) this.umbrellaMs += dt * 1000

    // --- distance & scroll ---
    // 速度→km/h 映射: speed 0 = 5 km/h, speed 1 = 30 km/h
    // 实际前进 m/s = km/h / 3.6，HUD 显示与距离计算用同一公式
    const speedKmh = this.speed * 25 + 5
    const advance = (speedKmh / 3.6) * dt // m/s
    this.distance += advance
    this.roadScroll += advance * 6

    // --- rain HP drain (no umbrella) ---
    if (!this.umbrella && this.rainIntensity > 0.5) {
      const drain = (this.rainIntensity - 0.5) * 3.5 * dt
      this.hp -= drain
    }
    // light passive heal when umbrella up & not too hurt
    if (this.umbrella && this.hp < this.maxHp && this.hp > 0) {
      this.hp += dt * 0.6
    }
    this.hp = clamp(this.hp, 0, this.maxHp)

    // --- classmate chase ---
    // classmate gains when player slow / braking / umbrella, loses when fast
    const lead = (this.speed - this.classmateThreshold) * 0.06 // per second
    this.classmateDist = clamp(this.classmateDist + (-lead * dt), 0, 1)
    if (this.classmateDist < 0.18 && Math.random() < dt * 0.5) {
      this.cb.onEvent({ type: 'classmate_close', text: '同学快追上来了！加速！', tone: 'warn' })
    }
    if (this.classmateDist <= 0.02) {
      this.hp = 0
      this.cb.onEvent({ type: 'caught', text: '被同学追上了！', tone: 'bad' })
      this.endGame('被同学追上了 / Caught by classmate')
      return
    }

    // --- spawn ---
    this.spawnTimer -= dt
    const difficulty = clamp(this.elapsed / 60, 0, 1)
    // 刷怪间隔从 2s 渐降到 0.9s（原 1.5→0.55 太密）
    const spawnInterval = lerp(2.0, 0.9, difficulty)
    if (this.spawnTimer <= 0) {
      this.spawn()
      this.spawnTimer = spawnInterval * rand(0.8, 1.4)
    }

    // --- entities ---
    for (const e of this.entities) {
      if (e.dead) continue
      e.z -= advance * 1.4
      if (e.type === 'pedestrian') {
        e.crossT += dt * 0.55 * (0.5 + e.seed * 0.0003)
        e.crossT = clamp(e.crossT, 0, 1)
        e.lane = (Math.round(lerp(e.fromLane, e.toLane, e.crossT))) as Lane
      }
      if (e.type === 'snail') {
        // snails creep forward slowly along road (toward player a touch)
        e.z -= dt * 0.4
      }
      if (e.frame === 0 && Math.random() < dt * 4) e.frame = 1
      else if (e.frame === 1 && Math.random() < dt * 4) e.frame = 0

      // collision when entity passes player plane (z <= 0)
      if (!e.hit && e.z <= 0.4) {
        // for pedestrians, check if their crossing position overlaps player
        const pedX = e.type === 'pedestrian' ? lerp(e.fromLane, e.toLane, e.crossT) : e.lane
        const overlaps = e.type === 'pedestrian'
          ? Math.abs(pedX - this.laneX) < 0.6
          : Math.round(this.laneX) === e.lane

        if (overlaps && e.z <= 0.2) {
          e.hit = true
          this.handleCollision(e)
        }
      }
      if (e.z < -3) e.dead = true
    }
    this.entities = this.entities.filter((e) => !e.dead)

    // --- combo decay ---
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }

    // --- timers ---
    if (this.invuln > 0) this.invuln -= dt * 1000
    if (this.dmgFlash > 0) this.dmgFlash -= dt * 1000
    if (this.screenShake > 0) this.screenShake -= dt * 1000

    // --- float texts ---
    for (const f of this.floats) {
      f.y += f.vy * dt
      f.life -= dt
    }
    this.floats = this.floats.filter((f) => f.life > 0)

    // --- animation frame counter ---
    this.frameCount++
    if (this.frameCount % 8 === 0) this.pedestrianFrame ^= 1
    this.umbrellaBob = Math.sin(this.elapsed * 4) * 1.2

    // --- rain motion ---
    for (const r of this.raindrops) {
      r.y += r.speed * dt * (0.6 + this.rainIntensity)
      r.x -= r.speed * 0.25 * dt
      if (r.y > H) { r.y = -r.len; r.x = rand(0, W) }
      if (r.x < 0) r.x = W
    }

    // --- emit stats ~10/s ---
    this.acc += dt
    if (this.acc > 0.1) {
      this.acc = 0
      this.emitStats()
    }

    if (this.hp <= 0) {
      this.endGame('生命值耗尽 / HP depleted')
    }
  }

  private handleCollision(e: Entity) {
    if (this.invuln > 0 && e.type !== 'coin') return
    switch (e.type) {
      case 'snail': {
        this.reputation = clamp(this.reputation - 6, 0, 100)
        this.delayMs += 1200
        this.classmateDist = clamp(this.classmateDist - 0.04, 0, 1)
        this.crashes++
        this.combo = 0
        this.spawnFloat(e, '-人品 蜗牛惨遭碾轧', '#d9a441')
        this.cb.onEvent({ type: 'snail', text: '碾到蜗牛了！-人品 -时间', tone: 'bad', lane: e.lane })
        this.invuln = 300
        this.dmgFlash = 200
        break
      }
      case 'pedestrian': {
        this.crashes++
        this.combo = 0
        this.delayMs += 2500
        this.classmateDist = clamp(this.classmateDist - 0.07, 0, 1)
        this.screenShake = 350
        if (Math.random() < 0.5) {
          // punched
          const dmg = randInt(14, 24)
          this.hp = clamp(this.hp - dmg, 0, this.maxHp)
          this.spawnFloat(e, `-HP 被揍了 ${dmg}`, '#b23a2e')
          this.cb.onEvent({ type: 'pedestrian_punch', text: '撞到行人，被揍了一拳！-生命值', tone: 'bad', lane: e.lane })
          this.dmgFlash = 400
          this.invuln = 700
        } else {
          // scolded
          this.reputation = clamp(this.reputation - 10, 0, 100)
          this.spawnFloat(e, '-人品 被痛骂', '#d9a441')
          this.cb.onEvent({ type: 'pedestrian_scold', text: '撞到行人，被骂了一顿！-人品', tone: 'bad', lane: e.lane })
          this.dmgFlash = 250
          this.invuln = 500
        }
        break
      }
      case 'puddle': {
        // splash damage based on speed and depth
        const raw = this.speed * e.depth * 38
        if (this.umbrella) {
          // umbrella blocks ~75% of splash
          const reduced = raw * 0.25
          this.hp = clamp(this.hp - reduced, 0, this.maxHp)
          this.spawnFloat(e, reduced > 4 ? `伞挡水 -HP ${Math.round(reduced)}` : '伞挡水！', '#6f8f4f')
          this.cb.onEvent({ type: 'puddle_blocked', text: '水坑！雨伞挡住了大半。', tone: 'good', lane: e.lane })
          this.dmgFlash = 120
        } else {
          this.hp = clamp(this.hp - raw, 0, this.maxHp)
          this.spawnFloat(e, `-HP 溅水 ${Math.round(raw)}`, '#5a6b6b')
          const speedKmh = Math.round(this.speed * 25 + 5)
          this.cb.onEvent({ type: 'puddle_splash', text: `水坑溅水！速度${speedKmh}km/h × 水深${Math.round(e.depth * 100)}%`, tone: 'bad', lane: e.lane })
          this.dmgFlash = 300
          this.screenShake = 200
        }
        this.delayMs += 600
        break
      }
      case 'coin': {
        this.combo++
        this.comboTimer = 4
        this.hp = clamp(this.hp + 6, 0, this.maxHp)
        this.classmateDist = clamp(this.classmateDist + 0.05, 0, 1)
        this.spawnFloat(e, `+HP 热咖啡 x${this.combo}`, '#c1440e')
        this.cb.onEvent({ type: 'pickup', text: '捡到热咖啡！+HP +Combo', tone: 'good', lane: e.lane })
        break
      }
    }
  }

  private spawnFloat(e: Entity, text: string, color: string) {
    const scale = projectZ(0)
    const x = CENTER_X + laneOffsetX(e.lane, scale)
    this.floats.push({ x, y: H - 30, text, color, life: 1, vy: -22 })
  }

  private endGame(reason: string) {
    if (this.phase === 'over') return
    this.phase = 'over'
    this.cb.onPhaseChange(this.phase)
    const result: GameResult = {
      score: this.computeScore(),
      distance: Math.round(this.distance),
      survivalMs: Math.round(this.survivalMs),
      maxHp: this.maxHp,
      finalRep: Math.round(this.reputation),
      umbrellaMs: Math.round(this.umbrellaMs),
      crashes: this.crashes,
      reason,
    }
    this.emitStats()
    this.cb.onGameOver(result)
  }

  // ===================== RENDERING =====================

  /** 世界水平偏移：玩家变道时整个世界反向移动，制造第一人称变道感 */
  private get viewShiftX(): number {
    return -this.laneX * 32
  }

  /** 玩家自身（车把/伞）的轻微偏移，方向同 laneX */
  private get playerShiftX(): number {
    return this.laneX * 6
  }

  private render() {
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false
    let sx = 0, sy = 0
    if (this.screenShake > 0) {
      sx = (Math.random() - 0.5) * 4
      sy = (Math.random() - 0.5) * 4
    }
    ctx.save()
    ctx.translate(Math.round(sx), Math.round(sy))

    this.drawSky()
    this.drawDistantCityscape()
    this.drawRoad()
    this.drawSidewalks()
    // draw entities sorted far→near
    const sorted = [...this.entities].sort((a, b) => b.z - a.z)
    for (const e of sorted) this.drawEntity(e)
    this.drawPlayer()
    this.drawRain()
    this.drawClassmateVignette()
    this.drawFloats()

    ctx.restore()

    // damage flash overlay
    if (this.dmgFlash > 0) {
      ctx.fillStyle = `rgba(178,58,46,${0.35 * (this.dmgFlash / 400)})`
      ctx.fillRect(0, 0, W, H)
    }

    // phase overlays handled by React HUD, but draw a subtle ready/over tint
    if (this.phase === 'ready' || this.phase === 'over') {
      ctx.fillStyle = 'rgba(26,20,16,0.55)'
      ctx.fillRect(0, 0, W, H)
    } else if (this.phase === 'paused') {
      ctx.fillStyle = 'rgba(26,20,16,0.45)'
      ctx.fillRect(0, 0, W, H)
    }
  }

  private drawSky() {
    const ctx = this.ctx
    // sepia gradient sky — warm, no blue
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 10)
    const dark = this.rainIntensity > 0.6 ? '#3a2e22' : '#5a4731'
    g.addColorStop(0, dark)
    g.addColorStop(1, '#8a6d3b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, HORIZON + 10)
    // distant clouds (pixel blocks)
    ctx.fillStyle = this.rainIntensity > 0.6 ? '#4a3b29' : '#6b5638'
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 70 + this.elapsed * 4) % (W + 60)) - 30
      const cy = 12 + (i % 3) * 8
      this.pixelRect(cx, cy, 24, 6)
      this.pixelRect(cx + 6, cy - 4, 14, 4)
      this.pixelRect(cx - 4, cy + 4, 18, 4)
    }
  }

  private drawDistantCityscape() {
    const ctx = this.ctx
    // rooftops silhouettes along the horizon
    ctx.fillStyle = '#2b2118'
    const baseY = HORIZON
    const offset = (this.roadScroll * 0.05) % 40
    for (let i = -1; i < 9; i++) {
      const x = i * 40 - offset
      const h = 8 + ((i * 7) % 5) * 3
      this.pixelRect(x, baseY - h, 36, h)
      // windows
      ctx.fillStyle = this.rainIntensity > 0.6 ? '#3a2e22' : '#c1440e'
      for (let wy = 0; wy < Math.floor(h / 6); wy++) {
        for (let wx = 0; wx < 3; wx++) {
          if ((i * 31 + wx * 7 + wy * 13) % 3 === 0) {
            this.pixelRect(x + 4 + wx * 10, baseY - h + 3 + wy * 6, 4, 3)
          }
        }
      }
      ctx.fillStyle = '#2b2118'
    }
  }

  private drawRoad() {
    const ctx = this.ctx
    const vx = this.viewShiftX
    // road trapezoid
    ctx.fillStyle = '#262019'
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.lineTo(W, H)
    ctx.lineTo(CENTER_X + vx + 18, HORIZON)
    ctx.lineTo(CENTER_X + vx - 18, HORIZON)
    ctx.closePath()
    ctx.fill()

    // wet sheen (subtle lighter band)
    ctx.fillStyle = 'rgba(120,100,70,0.10)'
    ctx.fillRect(0, HORIZON, W, H - HORIZON)

    // lane dividers — dashed, scrolling with perspective
    const dashLen = 14
    const cycle = 34
    const scroll = this.roadScroll % cycle
    ctx.fillStyle = '#e6d3a3'
    for (const laneEdge of [-0.5, 0.5]) {
      for (let i = 0; i < 14; i++) {
        const segStart = i * cycle - scroll
        const zNear = segStart / 6
        const zFar = (segStart + dashLen) / 6
        if (zNear < -2) continue
        const sNear = projectZ(Math.max(zNear, 0))
        const sFar = projectZ(Math.max(zFar, 0))
        const yNear = HORIZON + (GROUND_Y - HORIZON) * sNear
        const yFar = HORIZON + (GROUND_Y - HORIZON) * sFar
        if (yNear - yFar < 1) continue
        const xNear = CENTER_X + vx + laneEdge * 2 * LANE_NEAR_SPREAD * sNear
        const xFar = CENTER_X + vx + laneEdge * 2 * LANE_NEAR_SPREAD * sFar
        const wNear = Math.max(1, 3 * sNear)
        const wFar = Math.max(0.5, 3 * sFar)
        ctx.beginPath()
        ctx.moveTo(xNear - wNear / 2, yNear)
        ctx.lineTo(xNear + wNear / 2, yNear)
        ctx.lineTo(xFar + wFar / 2, yFar)
        ctx.lineTo(xFar - wFar / 2, yFar)
        ctx.closePath()
        ctx.fill()
      }
    }

    // road edge curbs (warm)
    ctx.fillStyle = '#6b5638'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side < 0 ? 0 : W, H)
      ctx.lineTo(CENTER_X + vx + side * 18, HORIZON)
      ctx.lineTo(CENTER_X + vx + side * 16, HORIZON)
      ctx.lineTo(side < 0 ? 8 : W - 8, H)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawSidewalks() {
    const ctx = this.ctx
    const vx = this.viewShiftX
    // mossy green sidewalk strips beyond the curbs
    ctx.fillStyle = '#5a6f3e'
    ctx.fillRect(0, HORIZON, 14, H - HORIZON)
    ctx.fillRect(W - 14, HORIZON, 14, H - HORIZON)
    // pixel grass tufts
    ctx.fillStyle = '#6f8f4f'
    for (let i = 0; i < 8; i++) {
      const sc = projectZ((i * 2 - (this.roadScroll * 0.5) % 16))
      const y2 = HORIZON + (GROUND_Y - HORIZON) * sc
      this.pixelRect(3 + vx * sc * 0.3, y2, 3, 2)
      this.pixelRect(W - 6 + vx * sc * 0.3, y2, 3, 2)
    }
    // lamp posts scrolling on left side
    const lampCycle = 60
    const lampScroll = (this.roadScroll * 0.5) % lampCycle
    for (let i = 0; i < 4; i++) {
      const z = (i * lampCycle - lampScroll) / 6
      if (z < 0.2 || z > 50) continue
      const sc = projectZ(z)
      const y = HORIZON + (GROUND_Y - HORIZON) * sc
      const x = 10 * sc + vx * sc
      const lh = Math.max(4, Math.round(28 * sc))
      ctx.fillStyle = '#2b2118'
      this.pixelRect(Math.round(x), Math.round(y - lh), Math.max(1, Math.round(2 * sc)), lh)
      // lamp head
      ctx.fillStyle = this.rainIntensity > 0.6 ? '#d9a441' : '#e6d3a3'
      this.pixelRect(Math.round(x) - 1, Math.round(y - lh - 2), Math.max(2, Math.round(4 * sc)), Math.max(2, Math.round(3 * sc)))
    }
  }

  private drawEntity(e: Entity) {
    if (e.z < -1) return
    const sc = projectZ(Math.max(e.z, 0))
    if (sc <= 0.02) return
    const y = HORIZON + (GROUND_Y - HORIZON) * sc
    // 远处的障碍物偏移幅度大（透视效果），近处偏移小
    const vx = this.viewShiftX * sc
    let x: number
    if (e.type === 'pedestrian') {
      const pedX = lerp(e.fromLane, e.toLane, e.crossT)
      x = CENTER_X + vx + pedX * LANE_NEAR_SPREAD * 2 * sc
    } else {
      x = CENTER_X + vx + e.lane * LANE_NEAR_SPREAD * 2 * sc
    }
    x = Math.round(x)
    const yy = Math.round(y)
    void yy

    if (e.type === 'snail') this.drawSnail(x, y, sc, e)
    else if (e.type === 'pedestrian') this.drawPedestrian(x, y, sc, e)
    else if (e.type === 'puddle') this.drawPuddle(x, y, sc, e)
    else if (e.type === 'coin') this.drawCoin(x, y, sc, e)
  }

  private drawSnail(x: number, y: number, sc: number, _e: Entity) {
    const ctx = this.ctx
    const w = Math.max(3, Math.round(14 * sc))
    const h = Math.max(2, Math.round(6 * sc))
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2)
    ctx.fillStyle = '#8a6d3b'
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h)
    ctx.fillStyle = '#6b5638'
    ctx.fillRect(Math.round(x - w / 4), Math.round(y - h - 2), Math.round(w / 2), h)
    ctx.fillStyle = '#a23e2e'
    ctx.fillRect(Math.round(x - 1), Math.round(y - h - 1), 2, 2)
    if (sc > 0.35) {
      ctx.fillStyle = '#8a6d3b'
      ctx.fillRect(Math.round(x + w / 2 - 1), Math.round(y - h - 3), 1, 2)
    }
  }

  private drawPedestrian(x: number, y: number, sc: number, e: Entity) {
    const ctx = this.ctx
    const h = Math.max(6, Math.round(26 * sc))
    const w = Math.max(3, Math.round(9 * sc))
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 2)
    const fr = this.pedestrianFrame
    ctx.fillStyle = '#2b2118'
    ctx.fillRect(Math.round(x - w / 2 + 1), Math.round(y - h / 3), Math.max(1, Math.round(w / 3)), Math.round(h / 3))
    ctx.fillRect(Math.round(x + w / 2 - Math.max(1, Math.round(w / 3)) - 1), Math.round(y - h / 3 + (fr ? 1 : -1)), Math.max(1, Math.round(w / 3)), Math.round(h / 3))
    const coatColors = ['#a23e2e', '#6f8f4f', '#d9a441', '#8a6d3b']
    const coat = coatColors[Math.floor(e.seed) % coatColors.length]
    ctx.fillStyle = coat
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, Math.round(h * 0.7))
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(Math.round(x - Math.max(1, w / 3)), Math.round(y - h - Math.max(2, h / 5)), Math.max(2, Math.round((w / 3) * 2)), Math.max(2, Math.round(h / 5)))
    if ((Math.floor(e.seed * 0.7) % 3) === 0 && sc > 0.3) {
      ctx.fillStyle = '#c1440e'
      ctx.fillRect(Math.round(x - w / 2 - 1), Math.round(y - h - Math.max(3, h / 3)), w + 2, 2)
    }
  }

  private drawPuddle(x: number, y: number, sc: number, e: Entity) {
    const ctx = this.ctx
    const w = Math.max(6, Math.round(40 * sc * e.width))
    const h = Math.max(2, Math.round(8 * sc))
    const dark = `rgba(${Math.round(40 + (1 - e.depth) * 30)},${Math.round(50 + (1 - e.depth) * 35)},${Math.round(45 + (1 - e.depth) * 30)},0.85)`
    ctx.fillStyle = dark
    ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h)
    ctx.fillRect(Math.round(x - w / 3), Math.round(y - h - 1), Math.round((w / 3) * 2), 1)
    ctx.fillStyle = 'rgba(217,164,65,0.4)'
    ctx.fillRect(Math.round(x - w / 4), Math.round(y - h / 2 - 1), Math.max(1, Math.round(w / 6)), 1)
  }

  private drawCoin(x: number, y: number, sc: number, _e: Entity) {
    const ctx = this.ctx
    const r = Math.max(2, Math.round(5 * sc))
    ctx.fillStyle = '#fff7e3'
    ctx.fillRect(Math.round(x - r), Math.round(y - r * 2), r * 2, r * 2)
    ctx.fillStyle = '#c1440e'
    ctx.fillRect(Math.round(x - r + 1), Math.round(y - r * 2 + 1), r * 2 - 2, r * 2 - 2)
    ctx.fillStyle = 'rgba(255,247,227,0.7)'
    ctx.fillRect(Math.round(x - 1), Math.round(y - r * 2 - 2), 1, 2)
    ctx.fillRect(Math.round(x), Math.round(y - r * 2 - 3), 1, 3)
  }

  private drawPlayer() {
    const ctx = this.ctx
    const px = Math.round(this.playerShiftX)
    ctx.fillStyle = '#2b2118'
    ctx.fillRect(40 + px, H - 18, 26, 4)
    ctx.fillRect(38 + px, H - 22, 6, 6)
    ctx.fillRect(W - 66 + px, H - 18, 26, 4)
    ctx.fillRect(W - 44 + px, H - 22, 6, 6)
    ctx.fillRect(CENTER_X - 2 + px, H - 22, 4, 8)
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(W - 50 + px, H - 24, 4, 3)
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(40 + px, H - 16, 6, 4)
    ctx.fillRect(W - 46 + px, H - 16, 6, 4)

    if (this.umbrella) {
      const bob = Math.round(this.umbrellaBob)
      ctx.fillStyle = '#c1440e'
      for (let i = 0; i < 14; i++) {
        const w = 180 - i * 10
        if (w <= 0) break
        ctx.fillRect(CENTER_X - w / 2 + px, 6 + i + bob, w, 1)
      }
      ctx.fillStyle = '#8a2e0a'
      for (let i = 0; i < 7; i++) {
        const x = CENTER_X - 80 + i * 26
        ctx.fillRect(x + px, 8 + bob, 1, 14)
      }
      ctx.fillStyle = '#d9a441'
      ctx.fillRect(CENTER_X + px, 4 + bob, 2, 3)
      ctx.fillStyle = '#2b2118'
      ctx.fillRect(CENTER_X + px, 20 + bob, 2, H - 40 - bob)
    } else {
      ctx.fillStyle = '#c1440e'
      ctx.fillRect(CENTER_X - 10 + px, H - 30, 20, 3)
      ctx.fillStyle = '#2b2118'
      ctx.fillRect(CENTER_X - 10 + px, H - 28, 20, 1)
    }

    ctx.fillStyle = '#6b5638'
    ctx.fillRect(CENTER_X - 14 + px, H - 8, 4, 8)
    ctx.fillRect(CENTER_X + 10 + px, H - 8, 4, 8)
  }

  private drawRain() {
    const ctx = this.ctx
    const count = Math.floor(this.raindrops.length * (0.4 + this.rainIntensity * 0.6))
    ctx.fillStyle = this.umbrella ? 'rgba(230,211,163,0.7)' : 'rgba(230,211,163,0.85)'
    for (let i = 0; i < count; i++) {
      const r = this.raindrops[i]
      ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, Math.round(r.len))
    }
    if (this.umbrella) {
      ctx.fillStyle = 'rgba(255,247,227,0.6)'
      for (let i = 0; i < 6; i++) {
        const sx = CENTER_X - 80 + Math.random() * 160
        const sy = 8 + Math.random() * 14
        ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1)
      }
    }
  }

  private drawClassmateVignette() {
    const ctx = this.ctx
    const danger = 1 - this.classmateDist
    if (danger <= 0.01) return
    const pulse = 0.4 + Math.sin(this.elapsed * 8) * 0.2
    const alpha = danger * 0.5 * pulse
    const h = Math.round(20 + danger * 50)
    const grad1 = ctx.createLinearGradient(0, H, 0, H - h)
    grad1.addColorStop(0, `rgba(178,58,46,${alpha})`)
    grad1.addColorStop(1, 'rgba(178,58,46,0)')
    ctx.fillStyle = grad1
    ctx.fillRect(0, H - h, W, h)

    if (danger > 0.55) {
      const op = (danger - 0.55) / 0.45
      ctx.fillStyle = `rgba(43,33,24,${op})`
      this.pixelRect(2, H - 24, 14, 24)
      this.pixelRect(4, H - 30, 10, 6)
      this.pixelRect(W - 16, H - 24, 14, 24)
      this.pixelRect(W - 14, H - 30, 10, 6)
      ctx.fillStyle = `rgba(178,58,46,${op * 0.8})`
      this.pixelRect(16, H - 18, 6, 2)
      this.pixelRect(W - 22, H - 18, 6, 2)
    }
  }

  private drawFloats() {
    const ctx = this.ctx
    ctx.font = '6px monospace'
    ctx.textAlign = 'center'
    for (const f of this.floats) {
      ctx.fillStyle = f.color
      ctx.globalAlpha = clamp(f.life, 0, 1)
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y))
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'start'
  }

  private pixelRect(x: number, y: number, w: number, h: number) {
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
}
