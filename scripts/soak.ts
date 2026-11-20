import {writeFileSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {parseArgs} from 'node:util'
import {contract} from '../src/core/contract'
import {idle} from '../src/core/input'
import type {Night} from '../src/core/islands'
import {GameEngine} from '../src/core/engine'

function integer(value:string|undefined,label:string,fallback?:number){
  if(value===undefined&&fallback!==undefined)return fallback
  const parsed=Number(value)
  if(!Number.isSafeInteger(parsed))throw Error('Invalid --'+label)
  return parsed
}
function random(seed:number){
  let state=seed>>>0
  return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
}
function megabytes(){return Number((process.memoryUsage().rss/1048576).toFixed(1))}

function main(){
  const collect=(globalThis as typeof globalThis&{gc?:()=>void}).gc
  if(!collect)throw Error('Run the soak test with Node --expose-gc')
  const {values}=parseArgs({options:{
    seed:{type:'string'},nights:{type:'string'},out:{type:'string'}
  }})
  const seed=integer(values.seed,'seed',7),nights=integer(values.nights,'nights',10)
  if(nights<1||nights>100)throw Error('--nights must be 1..100')
  if(!values.out)throw Error('Expected --out PATH')
  const started=performance.now(),results:string[]=[]
  let crashes=0,memStart=0,memEnd=0
  for(let index=0;index<nights;index++){
    const night=((index%3)+1) as Night
    try{
      let engine=new GameEngine(seed+index,{},night)
      if(index===0){collect();memStart=megabytes()}
      const next=random(seed+index),directions:[number,number][]=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]]
      let direction:[number,number]=[0,0]
      const ticks=Math.ceil(contract.tuning[`night${night}_duration_s` as 'night1_duration_s'|'night2_duration_s'|'night3_duration_s']*60)
      for(let tick=0;tick<ticks&&engine.outcome==='playing';tick++){
        if(tick%30===0)direction=directions[Math.floor(next()*directions.length)]
        const input=idle()
        input.move=[direction[0],direction[1]]
        input.jump=next()<.05
        input.dash=next()<.03
        input.pulse=next()<.02
        input.interact=next()<.10
        engine.step(input)
      }
      results.push(engine.outcome==='won'?'won':'lost')
      engine=new GameEngine(seed+index+1,{},(((index+1)%3)+1) as Night)
      collect()
      if(index===nights-1)memEnd=megabytes()
      void engine
    }catch(error){
      crashes++
      results.push('crash')
      console.error(`Soak night ${index+1} failed:`,error)
    }
  }
  const report={nights,crashes,results,mem_start_mb:memStart,mem_end_mb:memEnd,
    duration_s:Number(((performance.now()-started)/1000).toFixed(1))}
  writeFileSync(values.out,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
  if(crashes)process.exitCode=1
}

try{main()}catch(error){
  console.error(error instanceof Error?error.message:String(error))
  process.exitCode=1
}
