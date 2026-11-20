import configured from '../../game.contract.json'
const fallbackTuning = {
  player_speed: 4, carry_capacity: 10, lantern_cost: 3, lantern_count_night1: 5,
  pickup_radius: 1, interact_radius: 2, pulse_cost: 1, pulse_radius: 5,
  night1_duration_s: 300, flames: 3, invuln_s: 1, hit_drop_ratio: 0.5,
  pulse_stun_s: 3, pulse_push_m: 2, pulse_cooldown_s: 5, safe_radius: 5,
  shade_speed: 2, shade_hit_radius: 1, fall_enabled: true,
  score: { per_mote: 10, per_lantern: 500, per_stun: 50, per_second_left: 2, per_flame_left: 100 }
}
export interface Contract {
  contract_version: string
  team: string
  build_cmd: string
  run_cmd: string
  headless_cmd: string
  tuning: typeof fallbackTuning
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object')
  return value as Record<string, unknown>
}
export function number(value: unknown, min = -Infinity, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (integer && !Number.isSafeInteger(value))) {
    throw new Error('Invalid numeric value: ' + String(value))
  }
  return value
}
export function validateContract(raw: unknown): Contract {
  const data = record(raw)
  if (data.contract_version !== '1.0') throw new Error('Expected contract_version 1.0')
  for (const key of ['headless_cmd','build_cmd','run_cmd','team']) {
    if (typeof data[key] !== 'string' || !(data[key] as string).trim()) throw new Error('Missing ' + key)
  }
  const tuning = { ...fallbackTuning, ...record(data.tuning === undefined ? {} : data.tuning) }
  tuning.score = { ...fallbackTuning.score, ...record(tuning.score) }
  if (typeof tuning.fall_enabled !== 'boolean') throw new Error('Invalid fall_enabled')
  for (const [key, value] of Object.entries(tuning)) {
    if (key !== 'score' && key !== 'fall_enabled') number(value, 0)
  }
  for (const key of ['carry_capacity','lantern_cost','lantern_count_night1','pulse_cost','flames'] as const) number(tuning[key], 0, true)
  for (const value of Object.values(tuning.score)) number(value, 0)
  if (tuning.hit_drop_ratio > 1) throw new Error('Invalid hit_drop_ratio')
  return { contract_version: '1.0', team: data.team as string, build_cmd: data.build_cmd as string,
    run_cmd: data.run_cmd as string, headless_cmd: data.headless_cmd as string, tuning }
}
export const contract = validateContract(configured)
