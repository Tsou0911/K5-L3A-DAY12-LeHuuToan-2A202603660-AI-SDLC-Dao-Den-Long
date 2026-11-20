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

test('contract v1.3 snapshots preserve v1.2 fuel and dynamic capacity',()=>{
  const contract=JSON.parse(readFileSync('game.contract.json','utf8'))
  assert.equal(contract.contract_version,'1.3')
  for(const [night,duration,count] of [[1,240,5],[2,270,6],[3,300,7]]){
    const r=run(night,0)
    assert.deepEqual([r.at(0).time_left_s,r.at(0).lanterns.length,r.at(0).player.capacity],[duration,count,10])
    assert.deepEqual(Object.keys(r.at(0).lanterns[0]).sort(),['id','pos','deposited','lit','fuel','ever_lit','relit_count'].sort())
  }
  const setup=run(1,0,{...empty,player:{successful_lights:5,carried:20},lanterns:[{id:'L1',lit:true}]})
  assert.equal(setup.at(0).player.capacity,20)
  assert.deepEqual([setup.at(0).lanterns[0].fuel,setup.at(0).lanterns[0].ever_lit],[100,true])
})

test('fuel decays by one unit per tick and extinguishes at zero',()=>{
  const r=run(1,1,{...empty,player:{pos:[20,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:1/60}]})
  assert.deepEqual(r.events('lantern_out').map(e=>e.data),[{lantern_id:'L1'}])
  assert.deepEqual([r.at(1).lanterns[0].lit,r.at(1).lanterns[0].fuel,r.at(1).lanterns[0].deposited,r.at(1).lanterns[0].ever_lit],[false,0,0,true])
  const decay=run(1,60,{...empty,lanterns:[{id:'L1',lit:true,fuel:100}]})
  assert.equal(decay.at(60).lanterns[0].fuel,99)
})

test('a lamp retains safety at 30 fuel but loses it below 30',()=>{
  const safe=run(1,1,{...empty,lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:30+1/60}],
    shades:[{id:'S1',pos:[0,0,0]}]})
  assert.equal(safe.at(1).lanterns[0].fuel,30)
  assert.equal(safe.events('player_hit').length,0)
  const unsafe=run(1,1,{...empty,lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:30}],
    shades:[{id:'S1',pos:[0,0,0]}]})
  assert.equal(unsafe.at(1).lanterns[0].fuel,30)
  assert.equal(unsafe.events('player_hit').length,1)
})

test('pause freezes lamp fuel; resumed simulation resumes decay',()=>{
  const r=run(1,62,{...empty,lanterns:[{id:'L1',lit:true,fuel:50}]},[{tick:0,pause:true},{tick:1,pause:false},{tick:2,pause:true}],1)
  assert.equal(r.at(1).lanterns[0].fuel,50)
  assert.equal(r.at(2).lanterns[0].fuel,50)
  assert.equal(r.at(62).sim_tick,60)
  assert.equal(r.at(62).lanterns[0].fuel,49)
})

test('relight uses five motes, scores correctly and grows capacity',()=>{
  const r=run(1,1,{...empty,player:{carried:5,successful_lights:4},lanterns:[{id:'L1',pos:[0,0,0],ever_lit:true}]},[{tick:0,interact:true}])
  assert.deepEqual(r.events('lantern_lit').map(e=>e.data),[{lantern_id:'L1',relight:true}])
  assert.deepEqual(r.events('deposit')[0].data,{lantern_id:'L1',amount:5,deposited:5})
  assert.deepEqual([r.at(1).score,r.at(1).player.carried,r.at(1).player.capacity],[65,0,20])
  assert.deepEqual([r.at(1).lanterns[0].fuel,r.at(1).lanterns[0].relit_count],[100,1])
})

test('refuel uses carried motes, caps fuel and scores each mote once',()=>{
  const r=run(1,1,{...empty,player:{carried:1},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:99.9}]},[{tick:0,interact:true}])
  assert.deepEqual(r.events('refuel').map(e=>e.data),[{lantern_id:'L1',amount:1,fuel:100}])
  assert.deepEqual([r.at(1).score,r.at(1).player.carried,r.at(1).lanterns[0].fuel],[5,0,100])
})

test('refuel selects the nearest weak lantern and breaks distance ties by ID',()=>{
  const r=run(1,1,{...empty,player:{carried:1},lanterns:[
    {id:'L2',pos:[1,0,0],lit:true,fuel:50},
    {id:'L1',pos:[-1,0,0],lit:true,fuel:50}
  ]},[{tick:0,interact:true}])
  assert.equal(r.events('refuel')[0].data.lantern_id,'L1')
})

test('multiple shades drain cumulatively and emit ordered events every 60 simulation ticks',()=>{
  const r=run(1,60,{...empty,player:{pos:[25,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:29}],
    shades:[{id:'S2',pos:[.5,0,0]},{id:'S1',pos:[0,0,0]}]},[],60)
  assert.deepEqual(r.at(60).shades.map(s=>s.state),['drain','drain'])
  assert.deepEqual(r.events('fuel_drain').map(e=>[e.tick,e.data.shade_id]),[[60,'S1'],[60,'S2']])
  assert.equal(r.at(60).lanterns[0].fuel,18.2)
})

test('wander shades drain the nearest weak lantern before any unlit lantern',()=>{
  const r=run(1,60,{...empty,player:{pos:[25,0,0]},lanterns:[
    {id:'L2',pos:[9,0,0],lit:true,fuel:20},
    {id:'L1',pos:[11,0,0],lit:true,fuel:20},
    {id:'L3',pos:[10,0,0]}
  ],shades:[{id:'S1',pos:[10,0,0]}]},[],60)
  assert.equal(r.at(60).shades[0].state,'drain')
  assert.deepEqual(['L1','L2'].map(id=>r.at(60).lanterns.find(l=>l.id===id).fuel),[14.1,19])
})

test('a drainer returns to wander when its lamp goes out or it leaves the two-metre range',()=>{
  const extinguished=run(1,1,{...empty,player:{pos:[25,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:.1}],
    shades:[{id:'S1',pos:[0,0,0],state:'drain',target_lantern_id:'L1'}]})
  assert.equal(extinguished.events('lantern_out').length,1)
  assert.equal(extinguished.at(1).shades[0].state,'wander')
  const leaves=run(1,1,{...empty,player:{pos:[25,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],
    shades:[{id:'S1',pos:[3,0,0],state:'drain',target_lantern_id:'L1'}]})
  assert.equal(leaves.at(1).shades[0].state,'wander')
})

test('drain pulse scores fifteen total; entering six metres makes a drainer chase',()=>{
  const pulse=run(1,1,{...empty,player:{carried:3},lanterns:[{id:'L1',pos:[20,0,0],lit:true,fuel:20}],
    shades:[{id:'S1',pos:[3,0,0],state:'drain',target_lantern_id:'L1'}]},[{tick:0,pulse:true}])
  assert.deepEqual(pulse.events('pulse')[0].data,{stunned_ids:['S1']})
  assert.deepEqual([pulse.at(1).score,pulse.at(1).shades[0].state],[15,'stunned'])
  const chase=run(1,1,{...empty,player:{pos:[5,0,0]},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],
    shades:[{id:'S1',pos:[1,0,0],state:'drain',target_lantern_id:'L1'}]})
  assert.equal(chase.at(1).shades[0].state,'chase')
  const respawning=run(1,2,{...empty,player:{pos:[5,-11,0],flames:2},
    lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20}],
    shades:[{id:'S1',pos:[1,0,0],state:'drain',target_lantern_id:'L1'}]})
  assert.equal(respawning.at(2).shades[0].state,'chase')
})

test('refueling to thirty expels a shade without damage during the expulsion',()=>{
  const r=run(1,30,{...empty,player:{carried:1},lanterns:[{id:'L1',pos:[0,0,0],lit:true,fuel:20.1}],
    shades:[{id:'S1',pos:[0,0,0],state:'drain',target_lantern_id:'L1'}]},[{tick:0,interact:true}],1)
  assert.equal(r.events('refuel')[0].data.fuel,30)
  assert.equal(r.events('player_hit').length,0)
  assert.equal(r.at(30).shades[0].state,'wander')
  assert.ok(Math.abs(Math.hypot(r.at(30).shades[0].pos[0],r.at(30).shades[0].pos[2])-6)<1e-6)
})

test('dawn requires the night-specific ratio and awards no time bonus',()=>{
  const lamps=['L1','L2','L3','L4','L5'].map((id,i)=>({id,lit:i<3,fuel:i<3?100:0}))
  const win=run(1,1,{...empty,player:{flames:2},time_left_s:1/60,lanterns:lamps})
  assert.deepEqual(win.events('game_over').map(e=>e.data),[{result:'won',reason:'dawn_survived'}])
  assert.equal(win.end.score,547)
  const lose=run(1,1,{...empty,time_left_s:1/60,lanterns:lamps.map((l,i)=>({...l,lit:i<2,fuel:i<2?100:0}))})
  assert.deepEqual(lose.events('game_over').map(e=>e.data),[{result:'lost',reason:'dawn'}])
  for(const [night,total,required] of [[2,6,4],[3,7,5]]){
    const fixtures=Array.from({length:total},(_,i)=>({id:'L'+(i+1),lit:i<required,fuel:i<required?100:0}))
    const passes=run(night,1,{...empty,time_left_s:1/60,lanterns:fixtures})
    const misses=run(night,1,{...empty,time_left_s:1/60,lanterns:fixtures.map((l,i)=>({...l,lit:i<required-1,fuel:i<required-1?100:0}))})
    assert.equal(passes.end.state,'won')
    assert.equal(misses.end.state,'lost')
    assert.equal(misses.events('game_over')[0].data.reason,'dawn')
  }
})

test('no flames take precedence over dawn survival',()=>{
  const lamps=['L1','L2','L3','L4','L5'].map(id=>({id,lit:true}))
  const r=run(1,1,{...empty,player:{flames:0},time_left_s:1/60,lanterns:lamps})
  assert.deepEqual(r.events('game_over').map(e=>e.data),[{result:'lost',reason:'no_flames'}])
})
