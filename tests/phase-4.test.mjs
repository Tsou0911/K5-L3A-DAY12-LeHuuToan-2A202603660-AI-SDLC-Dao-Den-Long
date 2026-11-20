import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createServer} from 'node:http'

const leaderboardDir=mkdtempSync(join(tmpdir(),'island-leaderboard-'))
process.env.ISLAND_DATA_DIR=leaderboardDir
const {createLeaderboardMiddleware}=await import('../scripts/leaderboard-api.mjs')

test('one-night soak writes the required report in one run',()=>{
  const dir=mkdtempSync(join(tmpdir(),'island-soak-')),out=join(dir,'soak.json')
  try{
    execFileSync(process.execPath,['--expose-gc','--max-old-space-size=32','--max-semi-space-size=1','dist/soak.js','--seed','7','--nights','1','--out',out],{stdio:'pipe'})
    const result=JSON.parse(readFileSync(out,'utf8'))
    assert.equal(result.nights,1)
    assert.equal(result.crashes,0)
    assert.equal(result.results.length,1)
    assert.ok(['won','lost'].includes(result.results[0]))
    assert.ok(result.mem_start_mb>0)
    assert.ok(result.mem_end_mb>0)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('leaderboard validates, ranks, caps at ten, persists, and exports',async()=>{
  const output=join(leaderboardDir,'export.json')
  const middleware=createLeaderboardMiddleware()
  const server=createServer((request,response)=>middleware(request,response,()=>response.writeHead(404).end()))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address()
  assert.ok(address&&typeof address!=='string')
  const endpoint=`http://127.0.0.1:${address.port}/api/leaderboard`
  try{
    const later={name:'Later1',score:999,nights_won:2,achieved_at:'2026-01-01T00:00:02Z',seed:42}
    const earlier={...later,name:'Earlier',achieved_at:'2026-01-01T00:00:01Z'}
    for(const entry of [later,earlier,...Array.from({length:12},(_,i)=>({
      name:`Player${i}`,score:i,nights_won:i%4,achieved_at:`2026-02-01T00:00:${String(i).padStart(2,'0')}Z`,seed:i
    }))]){
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entry})})
      assert.equal(response.status,201)
    }
    const bad=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entry:{...later,name:'x!'}})})
    assert.equal(bad.status,400)
    const response=await fetch(endpoint)
    const data=await response.json()
    assert.equal(data.entries.length,10)
    assert.deepEqual(data.entries.slice(0,2).map(entry=>entry.name),['Earlier','Later1'])
    assert.equal(data.entries.at(-1).score,4)
    server.close()
    execFileSync(process.execPath,['scripts/run.mjs','--export-leaderboard',output],{env:process.env,stdio:'pipe'})
    assert.deepEqual(JSON.parse(readFileSync(output,'utf8')),data)
  }finally{
    if(server.listening)await new Promise(resolve=>server.close(resolve))
    rmSync(leaderboardDir,{recursive:true,force:true})
  }
})
