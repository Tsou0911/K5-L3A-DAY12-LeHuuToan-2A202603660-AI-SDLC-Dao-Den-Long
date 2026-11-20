import test from 'node:test'
import assert from 'node:assert/strict'
import {contract,validateContract} from '../src/core/contract'
import {benchmarkScenario} from '../src/core/benchmark'
import {GameEngine} from '../src/core/engine'

test('v1.3 declares runnable benchmark and soak commands',()=>{
  assert.equal(contract.contract_version,'1.3')
  assert.match(contract.bench_cmd,/bench/)
  assert.match(contract.soak_cmd,/soak/)
  assert.throws(()=>validateContract({...contract,bench_cmd:''}))
  assert.throws(()=>validateContract({...contract,soak_cmd:''}))
})

test('benchmark scenario is seeded and has the required fixed entity counts',()=>{
  const first=benchmarkScenario(42),repeat=benchmarkScenario(42),other=benchmarkScenario(43)
  assert.deepEqual(first,repeat)
  assert.notDeepEqual(first.shades,other.shades)
  assert.equal(first.shades?.length,200)
  assert.equal(first.motes?.length,100)
  assert.deepEqual(first.lanterns,[{id:'L1',lit:true,fuel:100},{id:'L2',lit:true,fuel:100},{id:'L3',lit:true,fuel:100}])
})

test('benchmark ticks move Shades without advancing the night or changing fuel',()=>{
  const engine=new GameEngine(42,benchmarkScenario(42),1),before=engine.snapshot()
  let after=before
  for(let tick=0;tick<60;tick++)after=engine.benchmarkStep()
  assert.equal(after.player.pos[0],0)
  assert.equal(after.player.pos[2],0)
  assert.equal(after.time_left_s,before.time_left_s)
  assert.equal(after.lanterns[0].fuel,before.lanterns[0].fuel)
  assert.equal(after.motes.length,100)
  assert.equal(after.shades.length,200)
  assert.notDeepEqual(after.shades.map(shade=>shade.pos),before.shades.map(shade=>shade.pos))
})
