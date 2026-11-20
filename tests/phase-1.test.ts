import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { GameEngine, HZ } from '../src/core/engine'
import { contract, validateContract } from '../src/core/contract'
import { parseScenario } from '../src/core/scenario'
import { idle, parseInputs, playback } from '../src/core/input'
import type { Scenario } from '../src/core/types'
import win from '../scenarios/win-one-lantern.json'
import one from '../scenarios/one-mote.json'

const empty: Scenario = {motes:[], shades:[]}
test('tick zero applies scenario by id without scoring or modifying defaults', () => {
  const engine = new GameEngine(7,{...empty, lanterns:[{id:'L4',lit:true}]})
  const s = engine.snapshot()
  assert.deepEqual([s.tick,s.score,s.state,s.time_left_s],[0,0,'playing',240])
  assert.deepEqual(s.player.pos,[0,0,0])
  assert.equal(s.player.flames,3)
  assert.deepEqual(s.lanterns.map(l => l.id),['L1','L2','L3','L4','L5'])
  assert.deepEqual(s.lanterns.map(l => l.deposited),[0,0,0,5,0])
  assert.deepEqual([s.lanterns[3].fuel,s.lanterns[3].ever_lit,s.player.capacity],[100,true,10])
  s.player.pos[0] = 99
  assert.equal(engine.snapshot().player.pos[0],0)
})
test('seed controls world and repeated simulations match', () => {
  const a = new GameEngine(8), b = new GameEngine(8)
  assert.notDeepEqual(a.snapshot().motes,new GameEngine(9).snapshot().motes)
  for (let i=0;i<180;i++) assert.deepEqual(a.step(),b.step())
  assert.deepEqual(a.snapshot(),b.snapshot())
})
test('normalized movement and camera-relative forward', () => {
  const a = new GameEngine(0,empty)
  for (let i=0;i<HZ;i++) a.step({...idle(), move:[1,1]})
  assert.ok(Math.abs(Math.hypot(...a.snapshot().player.pos)-5.75)<1e-10)
  const b = new GameEngine(0,empty)
  b.step({...idle(), move:[0,-1], cam_yaw_deg:90})
  assert.ok(Math.abs(b.snapshot().player.pos[0]+1/HZ)<1e-12)
})
test('pickup consumes one mote; scoring waits for deposit', () => {
  const a = new GameEngine(1,parseScenario(one))
  assert.deepEqual(a.step().map(e=>e.name),['mote_picked'])
  assert.deepEqual([a.snapshot().player.carried,a.snapshot().score,a.snapshot().motes.length],[1,0,0])
  assert.deepEqual(a.step(),[])
})
test('lighting all lanterns does not win early; dawn survival awards the v1.2 score', () => {
  const scenario=parseScenario(win)
  const early=new GameEngine(2,scenario)
  assert.deepEqual(early.step({...idle(),interact:true}).map(e=>e.name),['deposit','lantern_lit'])
  assert.deepEqual([early.snapshot().state,early.snapshot().score,early.snapshot().player.capacity],['playing',150,12])
  const dawn=new GameEngine(2,{...scenario,time_left_s:1/HZ})
  assert.deepEqual(dawn.step({...idle(),interact:true}).map(e=>e.name),['deposit','lantern_lit','game_over'])
  const s=dawn.snapshot()
  assert.deepEqual([s.state,s.player.carried,s.lanterns[0].deposited,s.lanterns[0].fuel,s.score],['won',0,10,100,1046])
  assert.deepEqual(dawn.step(),[])
  assert.deepEqual(dawn.snapshot(),s)
})
test('pulse spends energy, pushes, stuns, and respects cooldown', () => {
  const a = new GameEngine(0,{motes:[], player:{carried:4}, shades:[{id:'S',pos:[1,0,0]}]})
  const pulse = {...idle(),pulse:true}
  assert.deepEqual(a.step(pulse).map(e=>e.name),['pulse'])
  const s = a.snapshot()
  assert.deepEqual([s.player.carried,s.player.cooldown_ticks,s.shades[0].pos[0],s.score],[1,180,1+4/15,5])
  assert.ok(s.shades[0].state_ticks_left>0)
  assert.deepEqual(a.step(pulse),[])
})
test('shade damage drops carried motes, then protects for ninety ticks', () => {
  const a = new GameEngine(0,{motes:[],player:{carried:5},shades:[{id:'S',pos:[0,0,0]},{id:'T',pos:[0,0,0]}]})
  assert.equal(a.step()[0].name,'player_hit')
  assert.deepEqual([a.snapshot().player.flames,a.snapshot().player.carried],[2,3])
  for (let i=1;i<90;i++) assert.deepEqual(a.step(),[])
  assert.equal(a.step()[0].name,'player_hit')
})
test('loss on last flame and timeout', () => {
  const hit = new GameEngine(0,{motes:[],player:{flames:1},shades:[{id:'S',pos:[0,0,0]}]})
  hit.step()
  assert.equal(hit.snapshot().state,'lost')
  const timer = new GameEngine(0,{...empty,time_left_s:1})
  for (let i=1;i<HZ;i++) timer.step()
  assert.equal(timer.snapshot().state,'playing')
  assert.deepEqual(timer.step().at(-1),{type:'event',tick:60,name:'game_over',data:{result:'lost',reason:'dawn'}})
})
test('partial input, idle defaults and rising edges', () => {
  const read = playback(parseInputs({frames:[{tick:1,interact:true,move:[1,0]},{tick:3,interact:false},{tick:4,interact:true}]}))
  assert.deepEqual(read(0),idle())
  assert.equal(read(1).interact,true)
  assert.deepEqual(read(2),{...idle(),move:[1,0]})
  assert.equal(read(3).interact,false)
  assert.equal(read(4).interact,true)
})
test('reject malformed scenario and input', () => {
  for (const s of [null,[],{player:{pos:[0,0]}},{lanterns:[{id:'L6'}]},{random_shades:-1},{shades:[{}]}]) assert.throws(()=>parseScenario(s))
  for (const f of [null,{},[{tick:1},{tick:1}],[{tick:1},{tick:0}],[{tick:0,pulse:1}],[{tick:0,move:[1]}]]) assert.throws(()=>parseInputs(f))
})
test('contract rejects negative tuning and blank commands and fills omissions', () => {
  assert.equal(validateContract({...contract,tuning:{score:{per_stun:7}}}).tuning.player_speed,6)
  assert.throws(()=>validateContract({...contract,contract_version:'1.1'}))
  assert.throws(()=>validateContract({...contract,headless_cmd:' '}))
  assert.throws(()=>validateContract({...contract,tuning:{score:{per_stun:-1}}}))
  assert.throws(()=>validateContract({...contract,tuning:{pulse_radius:-1}}))
})

test('scenario reserves explicit IDs before naming anonymous entities', () => {
  const raw: Scenario = {motes:[[0,7,0]], shades:[{pos:[3,8,0]},{id:'S1',pos:[4,9,0]}]}
  const s = new GameEngine(0,raw).snapshot()
  assert.deepEqual(s.motes,[{id:'M1',pos:[0,7,0],kind:'random',ttl:0}])
  assert.deepEqual(s.shades.map(v=>v.id),['S2','S1'])
  assert.equal(s.score,0)
  assert.equal(raw.shades![0].id,undefined)
  assert.throws(()=>parseScenario({shades:[{id:'A',pos:[0,0,0]},{id:'A',pos:[0,0,0]}]}))
})
test('pickup and hit height limits, pulse sphere and safe zone boundaries', () => {
  const a = new GameEngine(7,{player:{carried:9},motes:[[1,1.5,0],[1.01,0,0],[0,1.501,0]],
    lanterns:[{id:'L1',pos:[-2,0,0],deposited:3}], shades:[{pos:[5,0.8,0]},{pos:[5.01,0,0]}]})
  assert.deepEqual(a.step({...idle(),interact:true,pulse:true}),[
    {type:'event',tick:1,name:'mote_picked',data:{carried:10}},
    {type:'event',tick:1,name:'deposit',data:{lantern_id:'L1',amount:7,deposited:10}},
    {type:'event',tick:1,name:'lantern_lit',data:{lantern_id:'L1',relight:false}},
    {type:'event',tick:1,name:'pulse',data:{stunned_ids:['S1']}}
  ])
  const setup: Scenario = {motes:[],shades:[{pos:[0,1.5,0]}],player:{carried:5}}
  const safe = new GameEngine(0,{...setup, lanterns:[{id:'L5',lit:true,pos:[6,80,0]}]})
  assert.deepEqual(safe.step(),[])
  const outside = new GameEngine(0,{...setup, lanterns:[{id:'L5',lit:true,pos:[6.01,80,0]}]})
  assert.deepEqual(outside.step(),[{type:'event',tick:1,name:'player_hit',data:{by:'shade',flames:2,dropped:2}}])
})
test('fall damage and final flame have consistent events', () => {
  const a = new GameEngine(1,{...empty,player:{pos:[17,-11,0],carried:7,flames:1}})
  assert.deepEqual(a.step(),[
    {type:'event',tick:1,name:'player_hit',data:{by:'fall',flames:0,lost:7,dropped:0}},
    {type:'event',tick:1,name:'game_over',data:{result:'lost',reason:'no_flames'}}
  ])
  assert.equal(a.snapshot().player.carried,0)
})
test('reinforcements report the ID inserted into the world', () => {
  const a = new GameEngine(0,{motes:[],lanterns:[{id:'L1',lit:true,pos:[0,0,0]}]})
  for(let i=1;i<780;i++) a.step()
  assert.deepEqual(a.step(),[{type:'event',tick:780,name:'shade_spawned',data:{id:'S3'}}])
  assert.equal(a.snapshot().shades.at(-1)?.id,'S3')
})
test('move limits and all four rising edges', () => {
  for (const move of [[0,1.01],[-1.01,0]]) assert.throws(()=>parseInputs([{tick:0,move}]))
  const pressed = {jump:true,interact:true,pulse:true,dash:true}
  const read = playback(parseInputs([{tick:0,...pressed,move:[-1,1]},{tick:2,pulse:false},{tick:3,pulse:true}]))
  assert.deepEqual(read(0),{...idle(),...pressed,move:[-1,1]})
  assert.deepEqual(read(1),{...idle(),move:[-1,1]})
  read(2)
  assert.deepEqual(read(3),{...idle(),pulse:true,move:[-1,1]})
})

const directory = mkdtempSync(join(tmpdir(),'lantern-phase1-'))
function cli(out: string, ...args: string[]) {
  return spawnSync(process.execPath,['dist/headless.js','--seed','42','--night','1','--out',join(directory,out),...args],{encoding:'utf8'})
}
test('CLI emits rounded snapshots, immediate events, default interval and identical bytes', () => {
  const scenario = join(directory,'world.json'), inputs = join(directory,'keys.json')
  writeFileSync(scenario,JSON.stringify({player:{pos:[0.123456,0,0],carried:2},motes:[[0,1,0]],shades:[{pos:[2,1,0]}]}))
  writeFileSync(inputs,JSON.stringify([{tick:0,pulse:true,move:[1,0]}]))
  const args = ['--ticks','21','--scenario',scenario,'--inputs',inputs]
  for(const file of ['a','b']) {
    const result = cli(file,...args)
    assert.equal(result.status,0,result.stderr)
  }
  const bytes = readFileSync(join(directory,'a'))
  assert.deepEqual(bytes,readFileSync(join(directory,'b')))
  const rows = bytes.toString().trimEnd().split('\n').map(line=>JSON.parse(line))
  assert.deepEqual(rows.map(r=>r.type),['snapshot','event','event','event','snapshot','snapshot','end'])
  const [zero,start,pick,pulse,ten,twenty,end] = rows
  assert.deepEqual(start,{type:'event',tick:0,name:'night_start',data:{night:1}})
  assert.deepEqual(Object.keys(zero).sort(),['type','tick','sim_tick','state','time_left_s','score','player','lanterns','shades','motes_active','motes','night','wind','drifters','charms'].sort())
  assert.deepEqual(zero.player,{pos:[0.123,0,0],flames:3,carried:2,vel:[0,0,0],grounded:true,invuln:false,capacity:10,dash_cd_s:0,pulse_cd_s:0,charm_s:0})
  assert.deepEqual(zero.shades,[{id:'S1',pos:[2,1,0],state:'wander'}])
  assert.deepEqual(zero.lanterns[0],{id:'L1',pos:[0,0,25],deposited:0,lit:false,fuel:0,ever_lit:false,relit_count:0})
  assert.deepEqual([zero.tick,zero.sim_tick,zero.score,zero.motes_active],[0,0,0,1])
  assert.deepEqual(pick,{type:'event',tick:1,name:'mote_picked',data:{carried:3}})
  assert.deepEqual(pulse,{type:'event',tick:1,name:'pulse',data:{stunned_ids:['S1']}})
  assert.deepEqual([ten.tick,ten.sim_tick,twenty.tick,twenty.sim_tick],[10,10,20,20])
  assert.equal(ten.shades[0].state,'stunned')
  assert.equal(ten.motes_active,0)
  assert.deepEqual(twenty.player.pos,[1.873,0,0])
  assert.deepEqual(end,{type:'end',ticks:21,state:'playing',score:5})
})
test('CLI rejects broken JSON and invalid structures with status 2 and stderr', () => {
  for(const [flag,json] of [['--inputs','{'],['--scenario','{'],['--inputs','[{"tick":0,"move":[0,-2]}]'],['--scenario','{"motes":[[1,2]]}']]){
    const path = join(directory,'invalid.json')
    writeFileSync(path,json)
    const result = cli('invalid-out','--ticks','1',flag,path)
    assert.equal(result.status,2)
    assert.match(result.stderr,/invalid.json/)
  }
})
