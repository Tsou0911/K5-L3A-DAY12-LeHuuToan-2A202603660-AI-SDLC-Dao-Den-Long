import { contract, number, record } from './contract'
import type { MoteState, Scenario, ShadeState, Snapshot } from './types'

export function fields(obj: Record<string, unknown>, allowed: string[]) {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) throw new Error('Unknown field: ' + key)
}
export function vector(value: unknown, size: number) {
  if (!Array.isArray(value) || value.length !== size) throw new Error('Expected vector of length ' + size)
  value.forEach(v => number(v))
}

type PreparedScenario = Omit<Scenario, 'motes' | 'shades'> & {
  motes?: MoteState[]
  shades?: (MoteState & Partial<Pick<ShadeState,'stun_ticks'>>)[]
}

export function parseScenario(raw: unknown): PreparedScenario {
  const s = structuredClone(record(raw))
  fields(s, ['player','random_motes','random_shades','motes','shades','lanterns','time_left_s'])
  if ('player' in s) {
    const p = record(s.player)
    fields(p, ['pos','carried','flames'])
    if ('pos' in p) vector(p.pos, 3)
    if ('carried' in p && number(p.carried, 0, true) > contract.tuning.carry_capacity) throw new Error('Capacity exceeded')
    if ('flames' in p) number(p.flames, 0, true)
  }
  if ('time_left_s' in s) number(s.time_left_s, 0)
  for (const k of ['random_motes','random_shades']) if (k in s && typeof s[k] !== 'boolean') number(s[k], 0, true)
  for (const k of ['lanterns','motes','shades']) {
    if (!(k in s)) continue
    const list = s[k]
    if (!Array.isArray(list)) throw new Error('Expected list: ' + k)
    if (k !== 'lanterns') {
      const entities = list.map(item => k === 'motes' && Array.isArray(item) ? {pos: item} : record(item))
      const reserved = new Set(entities.map(entity => 'id' in entity ? entity.id : undefined))
      const prefix = k === 'motes' ? 'M' : 'S'
      let next = 1
      for (const entity of entities) {
        if ('id' in entity) continue
        while (reserved.has(prefix + next)) next++
        Object.assign(entity, {id: prefix + next++})
      }
      s[k] = entities
    }
    const ids = new Set<string>()
    for (const item of s[k] as unknown[]) {
      const entity = record(item)
      fields(entity, ['id','pos', ...(k === 'lanterns' ? ['deposited','lit'] : k === 'shades' ? ['stun_ticks'] : [])])
      if (typeof entity.id !== 'string' || !entity.id.trim() || ids.has(entity.id)) throw new Error('Invalid or duplicate id')
      ids.add(entity.id)
      if (k !== 'lanterns' || 'pos' in entity) vector(entity.pos, 3)
      if (k === 'lanterns') {
        if (!Array.from({length: contract.tuning.lantern_count_night1}, (_, i) => 'L' + (i+1)).includes(entity.id)) throw new Error('Unknown lantern')
        if ('lit' in entity && typeof entity.lit !== 'boolean') throw new Error('Expected boolean lit')
        if ('deposited' in entity) {
          const n = number(entity.deposited, 0, true)
          const cost = contract.tuning.lantern_cost
          if (n > cost || ('lit' in entity && entity.lit !== (n === cost))) throw new Error('Inconsistent lantern')
        }
      }
      if ('stun_ticks' in entity) number(entity.stun_ticks, 0, true)
    }
  }
  return s as PreparedScenario
}

export function applyScenario(state: Snapshot, s: PreparedScenario) {
  Object.assign(state.player, s.player)
  if (s.time_left_s !== undefined) state.time_left_s = s.time_left_s
  if (s.motes) state.motes = s.motes
  if (s.shades) state.shades = s.shades.map(shade => ({stun_ticks: 0, ...shade}))
  for (const patch of s.lanterns ?? []) {
    const lamp = state.lanterns.find(l => l.id === patch.id)!
    Object.assign(lamp, patch)
    if (patch.lit === true) lamp.deposited = contract.tuning.lantern_cost
    lamp.lit = lamp.deposited >= contract.tuning.lantern_cost
  }
}
