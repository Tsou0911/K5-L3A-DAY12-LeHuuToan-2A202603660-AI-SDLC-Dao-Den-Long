export type Vec3 = [number, number, number]
export interface PlayerState { pos: Vec3; carried: number; flames: number; invuln_ticks: number; cooldown_ticks: number }
export interface MoteState { id: string; pos: Vec3 }
export interface LanternState extends MoteState { deposited: number; lit: boolean }
export interface ShadeState extends MoteState { stun_ticks: number }
export interface Snapshot {
  type: 'snapshot'
  tick: number
  seed: number
  state: 'playing' | 'won' | 'lost'
  score: number
  time_left_s: number
  player: PlayerState
  lanterns: LanternState[]
  motes: MoteState[]
  shades: ShadeState[]
}
export interface EventData {
  mote_picked: { carried: number }
  deposit: { lantern_id: string; amount: number; deposited: number }
  lantern_lit: { lantern_id: string }
  pulse: { stunned_ids: string[] }
  player_hit: { by: 'shade' | 'fall'; flames: number; dropped: number }
  shade_spawned: { id: string }
  game_over: { result: 'won'; reason: 'all_lit' } | { result: 'lost'; reason: 'dawn' | 'no_flames' }
}
export type EngineEvent = { [K in keyof EventData]: {
  type: 'event'; tick: number; name: K; data: EventData[K]
} }[keyof EventData]
export interface Scenario {
  player?: Partial<Pick<PlayerState,'pos' | 'carried' | 'flames'>>
  random_motes?: number | boolean
  random_shades?: number | boolean
  motes?: (Vec3 | MoteState)[]
  shades?: { id?: string; pos: Vec3; stun_ticks?: number }[]
  lanterns?: (Partial<LanternState> & { id: string })[]
  time_left_s?: number
}
export interface HeadlessInput { move: [number, number]; cam_yaw_deg: number; jump: boolean; interact: boolean; pulse: boolean; dash: boolean }
export type InputFrame = Partial<HeadlessInput> & { tick: number }
