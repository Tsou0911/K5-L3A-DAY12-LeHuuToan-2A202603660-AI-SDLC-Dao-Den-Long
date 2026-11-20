import type {Scenario} from './types'

function random(seed:number){
  let state=seed>>>0
  return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
}

export function benchmarkScenario(seed=42):Scenario{
  const next=random(seed)
  const position=():[number,number,number]=>{
    const radius=38*Math.sqrt(next()),angle=next()*Math.PI*2
    return [Number((radius*Math.cos(angle)).toFixed(3)),0,Number((radius*Math.sin(angle)).toFixed(3))]
  }
  return {
    random_motes:false,random_shades:false,random_drifters:false,
    player:{pos:[0,0,0]},
    motes:Array.from({length:100},(_,i)=>({id:'M'+(i+1),pos:position()})),
    shades:Array.from({length:200},(_,i)=>({id:'S'+(i+1),pos:position(),state:'wander' as const})),
    drifters:[],
    lanterns:[{id:'L1',lit:true,fuel:100},{id:'L2',lit:true,fuel:100},{id:'L3',lit:true,fuel:100}]
  }
}
