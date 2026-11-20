import { contract,number,record,HZ } from './contract'
import {islands,type Night} from './islands'
import type {Scenario,Snapshot,Entity} from './types'
export function fields(obj:Record<string,unknown>,allowed:string[]){
  for(const key of Object.keys(obj)) if(!allowed.includes(key)) throw Error('Unknown field: '+key)
}
export function vector(value:unknown,size:number){
  if(!Array.isArray(value)||value.length!==size) throw Error('Invalid vector')
  value.forEach(n=>number(n))
}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('Expected boolean')}
function nonnegative(v:unknown){return number(v,0,true)}
const flags=['random_drifters','wind_enabled']
export function parseScenario(raw:unknown,night:Night=1):Scenario{
  const s=structuredClone(record(raw))
  fields(s,['player','random_motes','random_shades',...flags,'motes','shades','lanterns','drifters','charms','time_left_s'])
  if('time_left_s' in s)number(s.time_left_s,0)
  for(const k of flags)if(k in s)bool(s[k])
  for(const k of ['random_motes','random_shades'])if(k in s && typeof s[k]!=='boolean')nonnegative(s[k])
  if('player' in s){
    const p=record(s.player)
    fields(p,['pos','vel','grounded','carried','flames','invuln_ticks','dash_cd_ticks','pulse_cd_ticks','charm_ticks'])
    for(const [k,v] of Object.entries(p)){
      if(k==='pos'||k==='vel')vector(v,3)
      else if(k==='grounded')bool(v)
      else nonnegative(v)
    }
    if(Number(p.carried)>contract.tuning.carry_capacity)throw Error('Capacity exceeded')
  }
  const lists={motes:[],shades:['stun_ticks','state','state_ticks_left'],lanterns:['deposited','lit'],drifters:['state','stolen','state_ticks_left'],charms:['available','respawn_ticks','respawn_s']}
  const prefixes={motes:'M',shades:'S',drifters:'D',charms:'C',lanterns:'L'}
  for(const k of Object.keys(lists) as (keyof typeof lists)[]){
    if(!(k in s))continue
    const list=s[k]
    if(!Array.isArray(list))throw Error('Expected list: '+k)
    const entries:Record<string,unknown>[]=list.map(v=>k==='motes'&&Array.isArray(v)?{pos:v}:record(v))
    const used=new Set<string>()
    for(const e of entries){
      if('id' in e){if(typeof e.id!=='string'||!e.id.trim()||used.has(e.id))throw Error('Invalid or duplicate id');used.add(e.id)}
    }
    let next=1
    for(const e of entries){
      fields(e,['id','pos',...lists[k]])
      if(!('id' in e)){
        if(k==='lanterns'||k==='charms')throw Error('Expected id')
        while(used.has(prefixes[k]+next))next++
        e.id=prefixes[k]+next++
      }
      if(k==='lanterns'){
        if(!islands[night].lamps.some((_,i)=>e.id==='L'+(i+1)))throw Error('Unknown lantern')
        if('lit' in e)bool(e.lit)
        if('deposited' in e){const n=nonnegative(e.deposited),cost=contract.tuning.lantern_cost;if(n>cost||('lit' in e && e.lit!==(n===cost)))throw Error('Inconsistent lantern')}
      }
      if(k==='charms'){
        if('available' in e)bool(e.available)
        if('respawn_s' in e){e.respawn_ticks=Math.round(number(e.respawn_s,0)*HZ);delete e.respawn_s}
        if(!('pos' in e)&&!islands[night].charms.some((_,i)=>e.id==='C'+(i+1)))throw Error('Charm needs a position')
      }
      if('pos' in e || (k!=='lanterns'&&k!=='charms'))vector(e.pos,3)
      for(const key of ['state_ticks_left','stun_ticks','respawn_ticks','stolen'])if(key in e)nonnegative(e[key])
      if('state' in e && !(k==='shades'?['wander','chase','spawning','recoil','stunned']:['idle','chase','flee']).includes(String(e.state)))throw Error('Invalid entity state')
    }
    s[k]=entries
  }
  return s as Scenario
}
export function applyScenario(w:Snapshot,s:Scenario){
  const p=s.player
  if(p){
    const {dash_cd_ticks,pulse_cd_ticks,...rest}=p
    Object.assign(w.player,rest)
    w.player.dash_cd=dash_cd_ticks??0
    w.player.cooldown_ticks=pulse_cd_ticks??0
  }
  if(s.time_left_s!==undefined)w.time_left_s=s.time_left_s
  if(s.motes)w.motes=(s.motes as Entity[]).map(m=>({...m,kind:'random',ttl:0}))
  if(s.shades)w.shades=s.shades.map(v=>({id:v.id!,pos:v.pos,state:v.state??(v.stun_ticks?'stunned':'wander'),state_ticks_left:v.state_ticks_left??v.stun_ticks??(v.state==='spawning'?1:v.state==='stunned'?120:v.state==='recoil'?60:0),push_ticks:0,angle:0}))
  if(s.drifters)w.drifters=s.drifters.map(v=>({state:'idle',stolen:0,state_ticks_left:v.state==='flee'?240:0,angle:0,...v,id:v.id!}))
  if(s.charms)w.charms=s.charms.map(v=>({available:true,respawn_ticks:0,...v,pos:v.pos??w.charms.find(c=>c.id===v.id)!.pos}))
  for(const patch of s.lanterns??[]){
    const lamp=w.lanterns.find(v=>v.id===patch.id)!
    Object.assign(lamp,patch)
    if(patch.lit)lamp.deposited=contract.tuning.lantern_cost
    lamp.lit=lamp.deposited===contract.tuning.lantern_cost
  }
}
