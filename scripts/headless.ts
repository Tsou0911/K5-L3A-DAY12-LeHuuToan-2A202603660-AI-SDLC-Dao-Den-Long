import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { GameEngine, HZ } from '../src/core/engine'
import { parseInputs, playback } from '../src/core/input'
import type { Night } from '../src/core/islands'
import { parseScenario } from '../src/core/scenario'

import type { Snapshot, Vec3 } from '../src/core/types'

function outputSnapshot(s: Snapshot) {
  const position = (pos: Vec3) => pos.map(n => Number(n.toFixed(3)))
  return {
    type: 'snapshot', tick: s.tick, sim_tick: s.sim_tick, night: s.night, wind: {active:s.wind.active,dir_deg:s.wind.dir_deg}, state: s.state,
    time_left_s: s.time_left_s, score: s.score,
    player: {pos: position(s.player.pos), flames: s.player.flames, carried: s.player.carried,
      vel: position(s.player.vel), grounded: s.player.grounded, invuln: s.player.invuln_ticks > 0,
      dash_cd_s: s.player.dash_cd/HZ, pulse_cd_s: s.player.cooldown_ticks/HZ, charm_s: s.player.charm_ticks/HZ},
    lanterns: s.lanterns.map(l => ({...l, pos: position(l.pos)})),
    shades: s.shades.map(shade => ({
      id: shade.id, pos: position(shade.pos), state: shade.state
    })),
    motes: s.motes.map(m => ({id:m.id,pos:position(m.pos),kind:m.kind,ttl_s:m.ttl/HZ})),
    charms:s.charms.map(c=>({id:c.id,available:c.available,respawn_s:c.respawn_ticks/HZ})),
    drifters:s.drifters.map(d=>({id:d.id,pos:position(d.pos),state:d.state,stolen:d.stolen})),
    motes_active: s.motes.length
  }
}

class InvalidInput extends Error {}
function integer(text: string | undefined, label: string, min: number) {
  if (!text || !/^-?\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min) throw new InvalidInput('Invalid --'+label)
  return Number(text)
}
function load<T>(path: string, parse: (v: unknown) => T) {
  const source = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  try { return parse(JSON.parse(source)) }
  catch (error) { throw new InvalidInput(path+' — '+String(error)) }
}
function main() {
  const keys = ['seed','night','ticks','out','scenario','inputs','snapshot-every']
  const options = Object.fromEntries(keys.map(k => [k, {type: 'string' as const}]))
  let args
  try {
    // parseArgs otherwise interprets a negative seed as another option.
    const argv = process.argv.slice(2)
    const i = argv.indexOf('--seed')
    if (i >= 0 && /^-\d+$/.test(argv[i+1] ?? '')) argv.splice(i, 2, '--seed='+argv[i+1])
    args = parseArgs({args: argv, options}).values
  } catch (error) { throw new InvalidInput(String(error)) }
  const seed = integer(args.seed,'seed',-Infinity)
  const ticks = integer(args.ticks,'ticks',0)
  const night = integer(args.night,'night',1) as Night
  if (night>3 || !args.out) throw new InvalidInput('Expected night 1..3 and an output file')
  const every = integer(args['snapshot-every'] ?? '10','snapshot-every',1)
  const scenario = args.scenario === undefined ? {} : load(args.scenario,v=>parseScenario(v,night))
  const nextInput = playback(args.inputs === undefined ? [] : load(args.inputs,parseInputs))
  const engine = new GameEngine(seed,scenario,night)
  const fd = openSync(args.out,'w')
  try {
    const write = (record: unknown) => writeFileSync(fd, JSON.stringify(record)+'\n')
    let snapshot = engine.snapshot()
    write(outputSnapshot(snapshot))
    write({type:'event',tick:0,name:'night_start',data:{night}})
    while (snapshot.tick < ticks && (snapshot.state === 'playing' || snapshot.state === 'paused')) {
      for (const event of engine.step(nextInput(snapshot.tick))) write(event)
      snapshot = engine.snapshot()
      if (snapshot.tick % every === 0) write(outputSnapshot(snapshot))
    }
    write({type:'end', ticks:snapshot.tick, state:snapshot.state, score:snapshot.score})
  } finally { closeSync(fd) }
}
try { main() } catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = error instanceof InvalidInput ? 2 : 1
}
