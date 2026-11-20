import { contract, number } from './contract'
import { idle } from './input'
import { applyScenario, parseScenario } from './scenario'
import type { EngineEvent, HeadlessInput, Scenario, Snapshot, Vec3 } from './types'

type OmitEnvelope<T> = T extends EngineEvent ? Pick<T,'name'|'data'> : never

export const HZ = 60
export const ISLAND_RADIUS = 16
const t = contract.tuning
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0]-b[0], a[2]-b[2])
function ring(angle: number, radius: number): Vec3 {
  return [Math.cos(angle)*radius, 0, Math.sin(angle)*radius]
}
function generator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}
function count(setting: number | boolean | undefined, fallback: number) {
  return typeof setting === 'number' ? setting : setting === false ? 0 : fallback
}

export class GameEngine {
  private readonly world: Snapshot
  private readonly random: () => number
  private readonly reinforce: boolean
  private remaining: number
  private verticalSpeed = 0

  constructor(seed: number, scenario: Scenario = {}) {
    number(seed, -Infinity, true)
    const s = parseScenario(scenario)
    this.random = generator(seed)
    this.reinforce = s.shades === undefined && count(s.random_shades, 2) > 0
    const initialMotes = s.motes ? 0 : count(s.random_motes, 30)
    const initialShades = s.shades ? 0 : count(s.random_shades, 2)
    this.world = {
      type: 'snapshot', tick: 0, seed, state: 'playing', score: 0, time_left_s: t.night1_duration_s,
      player: {pos: [0,0,0], carried: 0, flames: t.flames, invuln_ticks: 0, cooldown_ticks: 0},
      lanterns: Array.from({length: t.lantern_count_night1}, (_,i) => ({
        id: 'L'+(i+1), pos: ring(i*2*Math.PI/t.lantern_count_night1, 9), deposited: 0, lit: false
      })),
      motes: Array.from({length: initialMotes}, (_,i) => ({id: 'M'+(i+1), pos: ring(this.random()*2*Math.PI, 2+12*this.random())})),
      shades: Array.from({length: initialShades}, (_,i) => ({id: 'S'+(i+1), pos: ring(this.random()*2*Math.PI, 14), stun_ticks: 0}))
    }
    applyScenario(this.world, s)
    this.remaining = Math.ceil(this.world.time_left_s*HZ)
  }

  snapshot(): Snapshot { return structuredClone(this.world) }

  step(input: HeadlessInput = idle()): EngineEvent[] {
    const w = this.world, p = w.player
    const events: EngineEvent[] = []
    if (w.state !== 'playing') return events
    w.tick++
    const emit = (event: OmitEnvelope<EngineEvent>) => {
      events.push({type: 'event', tick: w.tick, ...event})
    }
    const hit = (by: 'shade' | 'fall') => {
      if (p.invuln_ticks || !p.flames) return
      const dropped = Math.floor(p.carried*t.hit_drop_ratio)
      p.carried -= dropped
      p.flames--
      p.invuln_ticks = Math.ceil(t.invuln_s*HZ)
      emit({name: 'player_hit', data: {by, flames: p.flames, dropped}})
    }
    const [x,z] = input.move
    const stride = t.player_speed / (HZ*Math.max(1, Math.hypot(x,z)))
    const yaw = input.cam_yaw_deg*Math.PI/180
    p.pos[0] += (x*Math.cos(yaw) + z*Math.sin(yaw))*stride
    p.pos[2] += (z*Math.cos(yaw) - x*Math.sin(yaw))*stride
    if (input.jump && p.pos[1] === 0) this.verticalSpeed = 5
    this.verticalSpeed -= 14/HZ
    p.pos[1] = Math.max(0, p.pos[1]+this.verticalSpeed/HZ)
    if (!p.pos[1]) this.verticalSpeed = 0
    p.invuln_ticks = Math.max(0, p.invuln_ticks-1)
    p.cooldown_ticks = Math.max(0, p.cooldown_ticks-1)

    w.motes = w.motes.filter(m => {
      if (p.carried >= t.carry_capacity || distance(p.pos,m.pos) > t.pickup_radius) return true
      p.carried++
      w.score += t.score.per_mote
      emit({name: 'mote_picked', data: {carried: p.carried}})
      return false
    })
    if (input.interact && p.carried > 0) {
      const lamp = w.lanterns.filter(l => !l.lit && distance(l.pos,p.pos) <= t.interact_radius)
        .sort((a,b) => distance(a.pos,p.pos)-distance(b.pos,p.pos))[0]
      if (lamp) {
        const amount = Math.min(p.carried, t.lantern_cost-lamp.deposited)
        lamp.deposited += amount
        p.carried -= amount
        emit({name: 'deposit', data: {lantern_id: lamp.id, amount, deposited: lamp.deposited}})
        if (lamp.deposited === t.lantern_cost) {
          lamp.lit = true
          w.score += t.score.per_lantern
          emit({name: 'lantern_lit', data: {lantern_id: lamp.id}})
        }
      }
    }
    if (input.pulse && !p.cooldown_ticks && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost
      p.cooldown_ticks = Math.ceil(t.pulse_cooldown_s*HZ)
      const stunned_ids: string[] = []
      for (const shade of w.shades) {
        if (distance(shade.pos,p.pos) > t.pulse_radius) continue
        stunned_ids.push(shade.id)
        if (!shade.stun_ticks) w.score += t.score.per_stun
        shade.stun_ticks = Math.ceil(t.pulse_stun_s*HZ)
        const angle = Math.atan2(shade.pos[2]-p.pos[2], shade.pos[0]-p.pos[0])
        shade.pos[0] += Math.cos(angle)*t.pulse_push_m
        shade.pos[2] += Math.sin(angle)*t.pulse_push_m
      }
      emit({name: 'pulse', data: {stunned_ids}})
    }
    if (this.reinforce && w.tick % (30*HZ) === 0) {
      const id = 'S'+(w.shades.length+1)
      w.shades.push({id, pos: ring(this.random()*2*Math.PI, 14), stun_ticks: 0})
      emit({name: 'shade_spawned', data: {id}})
    }
    const safe = w.lanterns.some(l => l.lit && distance(l.pos,p.pos) <= t.safe_radius)
    for (const shade of w.shades) {
      if (shade.stun_ticks > 0) { shade.stun_ticks--; continue }
      const dx = p.pos[0]-shade.pos[0], dz = p.pos[2]-shade.pos[2]
      const d = Math.hypot(dx,dz)
      if (d > 0) {
        const fraction = Math.min(1,t.shade_speed/(HZ*d))
        shade.pos[0] += dx*fraction
        shade.pos[2] += dz*fraction
      }
      if (!safe && distance(shade.pos,p.pos) <= t.shade_hit_radius) hit('shade')
    }
    if (t.fall_enabled && Math.hypot(p.pos[0],p.pos[2]) > ISLAND_RADIUS) {
      hit('fall')
      p.pos = [0,0,0]
      this.verticalSpeed = 0
    }
    this.remaining = Math.max(0,this.remaining-1)
    w.time_left_s = this.remaining/HZ
    if (!p.flames) w.state = 'lost'
    else if (w.lanterns.every(l => l.lit)) {
      w.state = 'won'
      w.score += Math.floor(w.time_left_s)*t.score.per_second_left + p.flames*t.score.per_flame_left
    } else if (!this.remaining) w.state = 'lost'
    if (w.state === 'won') emit({name: 'game_over', data: {result: 'won', reason: 'all_lit'}})
    if (w.state === 'lost') emit({name: 'game_over', data: {result: 'lost', reason: p.flames ? 'dawn' : 'no_flames'}})
    return events
  }
}
