import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import assert from 'node:assert/strict'
const proof='docs/proof/phase-3'
mkdirSync(proof,{recursive:true})
function run(name,night,ticks,flags=[],every=10){
  const file=proof+'/'+name+'.jsonl'
  const args=['dist/headless.js','--night',String(night),'--ticks',String(ticks),'--seed','42','--snapshot-every',String(every),...flags,'--out',file]
  const begin=performance.now()
  execFileSync(process.execPath,args)
  const ms=performance.now()-begin,bytes=readFileSync(file),rows=bytes.toString().trimEnd().split('\n').map(s=>JSON.parse(s))
  return {command:'node '+args.join(' '),elapsed_ms:ms,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),end:rows.at(-1)}
}
const pickup=run('one-mote',1,60,['--scenario','scenarios/one-mote.json'])
const win=run('final-lantern',1,60,['--scenario','scenarios/phase-3/win-at-dawn.json','--inputs','scenarios/interact.inputs.json'],1)
const flags=['--inputs','scenarios/phase-2/dash-pause.inputs.json']
const a=run('replay-a',2,1201,flags,120),b=run('replay-b',2,1201,flags,120)
assert.deepEqual(readFileSync(proof+'/replay-a.jsonl'),readFileSync(proof+'/replay-b.jsonl'))
const full=run('night-3',3,18000,['--scenario','scenarios/phase-2/full-night.json','--inputs','scenarios/phase-2/full-night.inputs.json'],60)
const result={node:process.version,platform:process.platform,pickup,win,replay_a:a,replay_b:b,identical_bytes:true,full}
writeFileSync(proof+'/headless.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result))
assert.equal(full.end.ticks,18000);assert.ok(full.elapsed_ms<=30000)
