import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'

const dir=mkdtempSync(join(tmpdir(),'island-v12-'))
const empty={motes:[],shades:[],drifters:[]}
let runId=0
function run(night,ticks,scenario={},inputs=[],every=1){
  const base=join(dir,String(++runId))
  writeFileSync(base+'.world',JSON.stringify(scenario))
  writeFileSync(base+'.keys',JSON.stringify(inputs))
  execFileSync(process.execPath,['dist/headless.js','--seed','42','--night',String(night),'--ticks',String(ticks),
    '--snapshot-every',String(every),'--scenario',base+'.world','--inputs',base+'.keys','--out',base+'.jsonl'])
  const records=readFileSync(base+'.jsonl','utf8').trim().split('\n').map(s=>JSON.parse(s))
  return {records,at:k=>records.find(s=>s.type==='snapshot'&&s.tick===k),events:n=>records.filter(s=>s.name===n),end:records.at(-1)}
}
test('three night configurations and scheduled spawns',()=>{
  for(const [night,duration,count,interval] of [[1,240,5,480],[2,270,6,420],[3,300,7,360]]){
    const r=run(night,300+interval,{},[],1)
    const zero=r.at(0)
    assert.deepEqual([zero.night,zero.time_left_s,zero.lanterns.length,zero.motes.length,zero.shades.length],[night,duration,count,20,0])
    assert.equal(new Set(zero.motes.map(m=>m.pos.join(','))).size,20)
    assert.equal(r.at(240).motes.length,21)
    assert.deepEqual(r.at(300).shades.map(s=>s.state),['spawning','spawning'])
    assert.deepEqual(r.events('shade_spawned').map(e=>e.tick),[300,300,300+interval])
    assert.equal(zero.charms.length,night-1)
  }
})
test('pause stops all simulation clocks; dash on air holds height for twelve ticks; facing starts +Z',()=>{
  const r=run(1,100,{...empty,player:{pos:[0,3,0]}},[{tick:0,dash:true},{tick:1,pause:true},{tick:2,pause:false},{tick:5,pause:true}])
  assert.deepEqual(r.events('dash').map(e=>e.tick),[1])
  assert.equal(r.at(2).state,'paused')
  for(const tick of [2,3,4,5]){
    const s=r.at(tick)
    assert.deepEqual([s.sim_tick,s.player,s.time_left_s],[1,r.at(1).player,r.at(1).time_left_s])
  }
  assert.equal(r.events('resumed')[0].tick,6)
  assert.deepEqual(r.at(16).player.pos,[0,3,2.8])
  assert.equal(r.at(94).player.dash_cd_s,1/60)
  assert.equal(r.at(95).player.dash_cd_s,0)
})
test('fall ignores immunity and only hits once, respawn at tick 61',()=>{
  const r=run(2,62,{...empty,player:{pos:[35,-11,5],carried:8,invuln_ticks:60}})
  assert.deepEqual(r.events('player_hit').map(e=>e.data),[{by:'fall',flames:2,dropped:0,lost:8}])
  assert.deepEqual(r.at(61).player.pos,[0,0,0]);assert.equal(r.at(61).player.invuln,true)
})
test('drop ring and TTL; sorted single hit and drifter steals before shade',()=>{
  const r=run(2,481,{motes:[],player:{carried:9},drifters:[{pos:[0,0,0],state:'chase'}],shades:[{id:'S2',pos:[0,0,0]},{id:'S1',pos:[0,0,0]}]},[],1)
  const s=r.at(1)
  assert.deepEqual(r.events('drifter_steal')[0].data,{drifter_id:'D1',amount:3,carried:6})
  assert.equal(r.events('player_hit').filter(e=>e.tick===1).length,1)
  assert.equal(s.shades.find(v=>v.id==='S1').state,'recoil')
  assert.equal(s.motes.length,3)
  for(const m of s.motes){assert.equal(m.kind,'dropped');assert.equal(m.ttl_s,8);assert.ok(Math.hypot(m.pos[0],m.pos[2])>=1.499)}
  const ttl=run(1,482,{motes:[],player:{carried:2,flames:20},shades:[{pos:[0,0,0]}]},[],1)
  assert.ok(ttl.at(480).motes.some(m=>m.id==='M1'))
  assert.ok(!ttl.at(481).motes.some(m=>m.id==='M1'))
})
test('charm refresh, free dashes, respawn after 2700 sim ticks',()=>{
  const r=run(2,2701,{...empty,player:{pos:[35,0,0]}},[{tick:1,dash:true},{tick:2,dash:false},{tick:3,dash:true},{tick:4,dash:false},{tick:13,dash:true},{tick:14,dash:false},{tick:15,move:[0,-1]},{tick:60,move:[0,0]}],1)
  assert.equal(r.events('charm_picked')[0].data.charm_ticks,600)
  assert.deepEqual(r.events('dash').slice(0,2).map(e=>e.tick),[2,14])
  // Isolate the respawn clock from falling off the narrow bridge.
  const clock=run(2,2701,{...empty,charms:[{id:'C1',pos:[0,0,0]}]},[{tick:0,move:[1,0]},{tick:30,move:[0,0]}],1)
  assert.equal(clock.at(2700).charms[0].available,false)
  assert.equal(clock.at(2701).charms[0].available,true)
})
test('drifter steals in safe zone despite immunity, releases motes when pulsed in flee',()=>{
  const r=run(2,123,{motes:[],shades:[],player:{carried:9,invuln_ticks:80},drifters:[{pos:[0,0,0]}],lanterns:[{id:'L1',pos:[0,0,0],lit:true}]},[{tick:1,pulse:true}])
  assert.equal(r.at(1).player.flames,3);assert.equal(r.at(1).drifters[0].stolen,3)
  assert.equal(r.events('drifter_drop')[0].data.amount,3)
  assert.equal(r.at(2).motes.length,3);assert.equal(r.at(3).motes.length,0)
  assert.equal(r.at(122).drifters.length,0)
  const spawn=run(3,1201,{random_shades:false,motes:[]},[],1)
  assert.equal(spawn.at(1199).drifters.length,0);assert.equal(spawn.at(1200).drifters[0].id,'D1')
})
test('last tick dawn wins at the new score and expels a shade without damage',()=>{
  const lamps=['L1','L2','L3','L4','L5'].map((id,i)=>i?{id,lit:true}:{id,pos:[0,0,0],deposited:9})
  const r=run(1,60,{player:{carried:1},motes:[],shades:[{pos:[0,0,0]}],time_left_s:1/60,lanterns:lamps},[{tick:0,interact:true}])
  assert.deepEqual(r.end,{type:'end',ticks:1,state:'won',score:1001})
  assert.equal(r.events('game_over')[0].data.reason,'dawn_survived')
  assert.equal(r.events('player_hit').length,0)
  assert.equal(r.at(1).shades[0].state,'wander')
  assert.ok(r.at(1).shades[0].pos[0]>0&&r.at(1).shades[0].pos[0]<6)
})
test('jump pads, bridge, tower, night-three warning interval and seeded wind',()=>{
  const ferry=run(2,100,{...empty,player:{pos:[20,0,18]}},[{tick:0,move:[-1,0]}])
  assert.ok(ferry.at(20).player.pos[1]>3);assert.ok(ferry.at(100).player.pos[0]>44)
  const tower=run(3,100,{...empty,player:{pos:[0,3,13]}})
  assert.ok(tower.at(60).player.pos[1]>=6)
  const wind=run(3,2101,empty,[],1)
  assert.equal(wind.at(1799).wind.active,false);assert.equal(wind.at(1800).wind.active,true)
  assert.equal(wind.at(2099).wind.active,true);assert.equal(wind.at(2100).wind.active,false)
  assert.notDeepEqual(wind.at(1800).player.pos,wind.at(1799).player.pos)
})

test('acceleration, air control, jump and braking; grounded input cannot double-jump',()=>{
  const r=run(1,16,empty,[{tick:0,jump:true,move:[1,0]},{tick:2,jump:false},{tick:3,jump:true},{tick:6,move:[0,0]}])
  assert.equal(r.at(6).player.vel[0],6)
  assert.equal(r.at(12).player.vel[0],0)
  assert.equal(r.at(1).player.pos[1],.117)
  assert.ok(r.at(4).player.vel[1]<r.at(1).player.vel[1])
  assert.equal(r.at(12).player.grounded,false)
})
test('pulse refreshes an existing stun, pushes 4 m in 15 ticks and refuses insufficient fuel',()=>{
  const setup={motes:[],player:{carried:3},shades:[{id:'S1',pos:[0,.8,0],state:'stunned',state_ticks_left:10},{id:'S2',pos:[0,5.801,0]}]}
  const r=run(1,121,setup,[{tick:0,pulse:true}])
  assert.deepEqual(r.events('pulse')[0].data,{stunned_ids:['S1']});assert.equal(r.at(1).score,5)
  assert.deepEqual(r.at(15).shades[0].pos,[4,.8,0]);assert.deepEqual(r.at(16).shades[0].pos,[4,.8,0])
  assert.equal(r.at(120).shades[0].state,'stunned');assert.equal(r.at(121).shades[0].state,'chase')
  const dry=run(1,1,{...setup,player:{carried:2}},[{tick:0,pulse:true}])
  assert.equal(dry.events('pulse').length,0);assert.equal(dry.at(1).player.pulse_cd_s,0)
})
test('new random mote waits until next tick; occupied points skip spawning',()=>{
  const r=run(1,240,{random_shades:false},[],240),first=r.at(240).motes.at(-1)
  const fixed=run(1,241,{player:{pos:first.pos},random_shades:false},[],1)
  assert.ok(fixed.at(240).motes.some(m=>m.id===first.id));assert.ok(!fixed.at(241).motes.some(m=>m.id===first.id))
  const full=run(1,1200,{random_shades:false},[],1200)
  assert.equal(full.at(1200).motes.length,24)
})
test('drifter chased away by pulse cannot steal and disappears after 240 simulation ticks',()=>{
  const r=run(2,241,{motes:[],shades:[],drifters:[{id:'D1',pos:[1,0,0],state:'chase'}],player:{carried:8}},[{tick:0,pulse:true}])
  assert.equal(r.at(1).drifters[0].state,'flee');assert.equal(r.at(1).drifters[0].stolen,0)
  assert.equal(r.events('drifter_steal').length,0);assert.equal(r.at(241).drifters.length,0)
})
test('partial deposit resolves ties by ID, loss has priority over lit lamps',()=>{
  const s={...empty,lanterns:[{id:'L2',pos:[1,0,0]},{id:'L1',pos:[-1,0,0]}],player:{carried:3}}
  const r=run(1,2,s,[{tick:0,interact:true}])
  assert.deepEqual(r.events('deposit')[0].data,{lantern_id:'L1',amount:3,deposited:3})
  assert.equal(r.at(2).score,15);assert.equal(r.at(2).lanterns[0].lit,false)
  const last=run(1,1,{...empty,player:{pos:[45,-11,0],flames:1},lanterns:['L1','L2','L3','L4','L5'].map(id=>({id,lit:true}))})
  assert.equal(last.events('game_over')[0].data.reason,'no_flames')
})
test('dash never prevents contact; charm speed and second pickup refresh',()=>{
  const r=run(1,1,{motes:[],shades:[{pos:[0,0,.3]}]},[{tick:0,dash:true}])
  assert.equal(r.at(1).player.flames,2)
  const c=run(3,20,{...empty,player:{pos:[30,0,25]},charms:[{id:'C1',pos:[30,0,25]},{id:'C2',pos:[32,0,25]}]},[{tick:0,move:[1,0]}])
  assert.equal(c.at(7).player.vel[0],7.2);assert.equal(c.events('charm_picked').length,2)
  assert.equal(c.at(c.events('charm_picked')[1].tick).player.charm_s,10)
})
test('pause freezes TTL, charm respawn and shade scheduling',()=>{
  const r=run(2,305,{player:{pos:[35,0,0],carried:4,flames:10},motes:[],random_shades:true,shades:[{pos:[35,0,0]}]},
    [{tick:1,pause:true},{tick:2,pause:false},{tick:5,pause:true}])
  assert.deepEqual(r.at(5).motes,r.at(1).motes)
  assert.deepEqual(r.at(5).charms,r.at(1).charms)
  assert.equal(r.at(5).player.invuln,true)
  assert.equal(r.events('shade_spawned')[0].tick,304)
})

test('shade detection, release and speed use the active night',()=>{
  for(const [night,speed] of [[1,4],[2,4],[3,4.5]]){
    const r=run(night,1,{...empty,player:{pos:[30,0,0]},shades:[{pos:[18,0,0]},{pos:[11.99,0,0],state:'chase'},{pos:[17.99,0,0]}]})
    const [acquire,release,far]=r.at(1).shades
    assert.deepEqual([acquire.state,release.state,far.state],['chase','wander','wander'])
    assert.ok(Math.abs(acquire.pos[0]-18-speed/60)<.001)
  }
})
test('bridge supports grounded travel and open water does not; ramps climb and walls block',()=>{
  const across=run(2,180,{...empty,player:{pos:[26,0,0]}},[{tick:0,move:[1,0]}])
  assert.equal(across.at(180).player.grounded,true);assert.ok(across.at(180).player.pos[0]>43)
  const water=run(2,65,{...empty,player:{pos:[35,0,2.1]}})
  assert.equal(water.events('player_hit')[0].data.by,'fall')
  const a=Math.PI/6,foot=[30*Math.cos(a),0,30*Math.sin(a)]
  const ramp=run(3,78,{...empty,player:{pos:foot}},[{tick:0,move:[-Math.cos(a),-Math.sin(a)]}])
  assert.equal(ramp.at(78).player.pos[1],3)
  const wall=run(3,40,{...empty,player:{pos:[0,0,25]}},[{tick:0,move:[0,-1]}])
  assert.ok(wall.at(40).player.pos[2]>=24);assert.equal(wall.at(40).player.pos[1],0)
})
test('wind cancels by scenario; drifters idle when eligibility is lost',()=>{
  const w=run(3,1801,{...empty,wind_enabled:false},[],1800)
  assert.equal(w.at(1800).wind.active,false)
  const r=run(2,2,{...empty,player:{carried:5},drifters:[{pos:[14,0,0]}],lanterns:[{id:'L1',pos:[0,0,0]}]},[{tick:1,interact:true}])
  assert.equal(r.at(1).drifters[0].state,'chase');assert.equal(r.at(2).drifters[0].state,'idle')
})
