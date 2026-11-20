import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { GameEngine } from '../src/core/engine'
import { parseInputs, playback } from '../src/core/input'
import { parseScenario } from '../src/core/scenario'

import type { Snapshot, Vec3 } from '../src/core/types'

function outputSnapshot(s: Snapshot) {
  const position = (pos: Vec3) => pos.map(n => Number(n.toFixed(3)))
  return {
    type: 'snapshot', tick: s.tick, sim_tick: s.tick, state: s.state,
    time_left_s: s.time_left_s, score: s.score,
    player: {pos: position(s.player.pos), flames: s.player.flames, carried: s.player.carried},
    lanterns: s.lanterns.map(l => ({...l, pos: position(l.pos)})),
    shades: s.shades.map(shade => ({
      id: shade.id, pos: position(shade.pos), state: shade.stun_ticks > 0 ? 'stunned' : 'chasing'
    })),
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
  if (args.night !== '1' || !args.out) throw new InvalidInput('Expected --night 1 and --out <file>')
  const every = integer(args['snapshot-every'] ?? '10','snapshot-every',1)
  const scenario = args.scenario === undefined ? {} : load(args.scenario,parseScenario)
  const nextInput = playback(args.inputs === undefined ? [] : load(args.inputs,parseInputs))
  const engine = new GameEngine(seed,scenario)
  const fd = openSync(args.out,'w')
  try {
    const write = (record: unknown) => writeFileSync(fd, JSON.stringify(record)+'\n')
    let snapshot = engine.snapshot()
    write(outputSnapshot(snapshot))
    while (snapshot.tick < ticks && snapshot.state === 'playing') {
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
