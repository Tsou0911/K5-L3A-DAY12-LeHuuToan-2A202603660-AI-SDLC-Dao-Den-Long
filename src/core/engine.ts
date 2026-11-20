import { contract,number,HZ } from './contract'
import { idle } from './input'
import { ground,islands,tower,type Night } from './islands'
import { applyScenario,parseScenario } from './scenario'
import type { Snapshot,Vec3,Scenario,EngineEvent,HeadlessInput,ShadeState,Entity,Drifter } from './types'

export {HZ}
const t=contract.tuning
const planar=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[2]-b[2])
const angle=(a:Vec3,b:Vec3)=>Math.atan2(b[2]-a[2],b[0]-a[0])
const copy=(v:Vec3):Vec3=>[...v]
const dec=(n:number)=>Math.max(0,n-1)
const byId=(a:Entity,b:Entity)=>a.id.localeCompare(b.id,'en',{numeric:true})
type Payload<T>=T extends EngineEvent?Pick<T,'name'|'data'>:never
export class GameEngine {
  private w:Snapshot
  private randomState:number
  private remaining:number
  private facing=Math.PI/2
  private dashAngle=this.facing
  private launch:Vec3|null=null
  private dashEnded=false
  private events:EngineEvent[]=[]
  private sequence={M:0,S:0,D:0}
  private readonly map
  private readonly randomMotes:boolean
  private readonly randomShades:boolean
  private readonly randomDrifters:boolean
  private readonly windEnabled:boolean
  constructor(seed:number,raw:Scenario={},readonly night:Night=1){
    this.randomState=number(seed,-Infinity,true)>>>0
    const s=parseScenario(raw,night)
    this.map=islands[night]
    this.randomMotes=s.random_motes!==false && s.random_motes!==0 && (s.motes===undefined || !!s.random_motes)
    this.randomShades=s.random_shades!==false && s.random_shades!==0 && (s.shades===undefined || !!s.random_shades)
    this.randomDrifters=s.random_drifters??(s.drifters===undefined)
    this.windEnabled=s.wind_enabled??true
    this.w={type:'snapshot',seed,night,state:'playing',tick:0,sim_tick:0,paused:false,score:0,time_left_s:this.map.duration,
      wind:{active:false,dir_deg:0,warning:false},player:{pos:copy(this.map.start),vel:[0,0,0],grounded:true,flames:t.flames,carried:0,
      invuln_ticks:0,cooldown_ticks:0,dash_ticks:0,dash_cd:0,charm_ticks:0,respawn_ticks:0},motes:[],shades:[],drifters:[],
      charms:this.map.charms.map((pos,i)=>({id:'C'+(i+1),pos:copy(pos),available:true,respawn_ticks:0})),
      lanterns:this.map.lamps.map((pos,i)=>({id:'L'+(i+1),pos:copy(pos),lit:false,deposited:0}))}
    if(this.randomMotes&&!s.motes){
      const count=typeof s.random_motes==='number'?s.random_motes:t.motes_initial
      for(let i=0;i<Math.min(count,t.motes_max,this.map.motes.length);i++)this.spawnMote()
    }
    applyScenario(this.w,s)
    for(const [prefix,list] of [['M',this.w.motes],['S',this.w.shades],['D',this.w.drifters]] as const){
      for(const entity of list)if(new RegExp('^'+prefix+'[0-9]+$').test(entity.id))this.sequence[prefix]=Math.max(this.sequence[prefix],Number(entity.id.slice(1)))
    }
    const p=this.w.player
    p.grounded=s.player?.grounded??(p.pos[1]===ground(night,p.pos[0],p.pos[2])&&p.vel[1]===0)
    this.remaining=Math.ceil(this.w.time_left_s*HZ)
  }
  snapshot(){return structuredClone(this.w)}
  private random(){this.randomState=(Math.imul(1664525,this.randomState)+1013904223)>>>0;return this.randomState/4294967296}
  private pick<T>(items:T[]){return items[Math.floor(this.random()*items.length)]}
  private emit(e:Payload<EngineEvent>){this.events.push({type:'event',tick:this.w.tick,...e})}
  private spawnMote(){
    const list=this.w.motes
    if(list.length>=t.motes_max)return
    const pos=this.pick(this.map.motes.filter(v=>!list.some(m=>planar(v,m.pos)<.001)))
    if(pos)list.push({id:'M'+(++this.sequence.M),pos:copy(pos),kind:'random',ttl:0})
  }
  private drop(pos:Vec3,n:number,scatter:boolean){
    for(let i=0;i<n;i++){
      const v=copy(pos)
      if(scatter){const a=this.random()*2*Math.PI,r=1.5+this.random();v[0]+=r*Math.cos(a);v[2]+=r*Math.sin(a)}
      const h=ground(this.night,v[0],v[2])
      if(Number.isFinite(h))v[1]=h
      if(this.w.motes.length>=t.motes_max){
        const replace=this.w.motes.findIndex(m=>m.kind==='random')
        this.w.motes.splice(Math.max(0,replace),1)
      }
      this.w.motes.push({id:'M'+(++this.sequence.M),pos:v,kind:'dropped',ttl:t.drop_ttl_ticks})
    }
  }
  private clocks(){
    const w=this.w,p=w.player
    this.remaining=dec(this.remaining);w.time_left_s=this.remaining/HZ
    p.dash_cd=dec(p.dash_cd);p.cooldown_ticks=dec(p.cooldown_ticks);p.charm_ticks=dec(p.charm_ticks);p.invuln_ticks=dec(p.invuln_ticks)
    w.motes=w.motes.filter(m=>m.kind==='random'||--m.ttl>0)
    for(const c of w.charms)if(!c.available && (c.respawn_ticks=dec(c.respawn_ticks))===0)c.available=true
    for(const s of w.shades)if(s.state_ticks_left>0 && --s.state_ticks_left===0)s.state='wander'
    w.drifters=w.drifters.filter(d=>d.state!=='flee'||--d.state_ticks_left>0)
    if(this.night===3 && this.windEnabled){
      const phase=w.sim_tick%1800
      if(phase===1680)w.wind.dir_deg=this.random()*360
      w.wind.warning=phase>=1680
      w.wind.active=w.sim_tick>=1800 && phase<300
    }
  }
  private movement(i:HeadlessInput){
    const w=this.w,p=w.player
    if(p.respawn_ticks){
      if(--p.respawn_ticks===0){p.pos=copy(this.map.start);p.vel=[0,0,0];p.grounded=true;p.invuln_ticks=90}
      return false
    }
    const [x,z]=i.move,n=Math.max(1,Math.hypot(x,z)),yaw=i.cam_yaw_deg*Math.PI/180
    const dx=(x*Math.cos(yaw)+z*Math.sin(yaw))/n,dz=(z*Math.cos(yaw)-x*Math.sin(yaw))/n
    if(x||z)this.facing=Math.atan2(dz,dx)
    const pad=p.grounded && this.map.pads.find(b=>planar(b.pos,p.pos)<=1 && Math.abs(p.pos[1]-b.pos[1])<.1)
    if(pad){p.vel=copy(pad.launch);this.launch=copy(pad.launch);p.grounded=false}
    else if(i.jump&&p.grounded){p.vel[1]=t.jump_speed;p.grounded=false}
    if(i.dash && !p.dash_ticks && (!p.dash_cd || p.charm_ticks)){
      this.dashAngle=this.facing;p.dash_ticks=Math.round(t.dash_duration_s*HZ)
      p.dash_cd=p.charm_ticks?0:Math.round(t.dash_cooldown_s*HZ)
      this.emit({name:'dash',data:{}})
    }
    const oldY=p.pos[1]
    if(p.dash_ticks){
      p.vel[0]=t.dash_speed*Math.cos(this.dashAngle);p.vel[2]=t.dash_speed*Math.sin(this.dashAngle);p.dash_ticks--
      this.dashEnded=p.dash_ticks===0
    }else{
      if(this.dashEnded){p.vel[0]=0;p.vel[2]=0;this.dashEnded=false}
      if(this.launch){p.vel[0]=this.launch[0];p.vel[2]=this.launch[2]}
      else{
        const speed=p.charm_ticks?t.charm_speed:t.player_speed
        const vx=dx*speed-p.vel[0],vz=dz*speed-p.vel[2],fraction=Math.min(1,speed/(HZ*t.accel_s*Math.hypot(vx,vz)))
        p.vel[0]+=vx*fraction;p.vel[2]+=vz*fraction
      }
      p.pos[1]+=p.vel[1]/HZ;p.vel[1]+=t.gravity/HZ
    }
    const wa=w.wind.dir_deg*Math.PI/180
    const nx=p.pos[0]+(p.vel[0]+(w.wind.active?2*Math.cos(wa):0))/HZ
    const nz=p.pos[2]+(p.vel[2]+(w.wind.active?2*Math.sin(wa):0))/HZ
    const dest=ground(this.night,nx,nz)
    if(!tower(this.night,nx,nz)&&dest<=Math.max(oldY,p.pos[1])+.22){p.pos[0]=nx;p.pos[2]=nz}
    const h=ground(this.night,p.pos[0],p.pos[2])
    p.grounded=oldY>=h-.22 && p.pos[1]<=h && p.vel[1]<=0
    if(p.grounded){p.pos[1]=h;p.vel[1]=0;this.launch=null}
    if(p.pos[1]<t.fall_y){
      const lost=p.carried;p.carried=0;p.flames=dec(p.flames);p.dash_ticks=0;p.respawn_ticks=p.flames?t.respawn_ticks:0
      this.launch=null;this.dashEnded=false;p.vel=[0,0,0]
      this.emit({name:'player_hit',data:{by:'fall',flames:p.flames,lost,dropped:0}})
      return false
    }
    return true
  }
  private collect(interact:boolean){
    const w=this.w,p=w.player
    const near=(v:Vec3)=>planar(v,p.pos)<=t.pickup_radius && Math.abs(v[1]-p.pos[1])<=t.contact_height
    w.motes=w.motes.filter(m=>{
      if(!near(m.pos)||p.carried>=t.carry_capacity)return true
      this.emit({name:'mote_picked',data:{carried:++p.carried}});return false
    })
    for(const c of w.charms)if(c.available && near(c.pos)){
      c.available=false;c.respawn_ticks=t.charm_respawn_ticks;p.charm_ticks=t.charm_ticks;p.dash_cd=0
      this.emit({name:'charm_picked',data:{charm_id:c.id,charm_ticks:p.charm_ticks}})
    }
    if(!interact||!p.carried)return
    const l=w.lanterns.filter(l=>!l.lit && planar(l.pos,p.pos)<=t.interact_radius)
      .sort((a,b)=>planar(a.pos,p.pos)-planar(b.pos,p.pos)||byId(a,b))[0]
    if(!l)return
    const amount=Math.min(p.carried,t.lantern_cost-l.deposited)
    l.deposited+=amount;p.carried-=amount;w.score+=amount*t.score.per_mote
    this.emit({name:'deposit',data:{lantern_id:l.id,amount,deposited:l.deposited}})
    if(l.deposited===t.lantern_cost){l.lit=true;w.score+=t.score.per_lantern;this.emit({name:'lantern_lit',data:{lantern_id:l.id}})}
  }
  private constrainShade(s:ShadeState){
    for(const l of this.w.lanterns)if(l.lit && planar(l.pos,s.pos)<t.safe_radius){
      const a=angle(l.pos,s.pos);s.pos[0]=l.pos[0]+Math.cos(a)*t.safe_radius;s.pos[2]=l.pos[2]+Math.sin(a)*t.safe_radius
    }
  }
  private pulse(){
    const w=this.w,p=w.player
    if(p.carried<t.pulse_cost||p.cooldown_ticks)return
    p.cooldown_ticks=Math.round(t.pulse_cooldown_s*HZ);p.carried-=t.pulse_cost
    const inRange=(v:Vec3)=>Math.hypot(planar(v,p.pos),v[1]-p.pos[1]-t.pulse_origin_y)<=t.pulse_radius
    const ids:string[]=[]
    for(const s of w.shades)if(inRange(s.pos)){
      s.angle=angle(p.pos,s.pos);s.state='stunned';s.state_ticks_left=Math.round(t.pulse_stun_s*HZ);s.push_ticks=t.pulse_push_ticks
      ids.push(s.id);w.score+=t.score.per_stun
    }
    this.emit({name:'pulse',data:{stunned_ids:ids}})
    for(const d of w.drifters)if(inRange(d.pos)){
      if(d.state==='chase')this.flee(d,240)
      else if(d.state==='flee'&&d.stolen){
        this.drop(d.pos,d.stolen,false);this.emit({name:'drifter_drop',data:{drifter_id:d.id,amount:d.stolen}})
        d.stolen=0;this.flee(d,120)
      }
    }
  }
  private flee(d:Drifter,ticks:number){d.angle=angle(this.w.player.pos,d.pos);d.state='flee';d.state_ticks_left=ticks}
  private shadeMove(s:ShadeState,d:number){
    const x=s.pos[0]+d*Math.cos(s.angle),z=s.pos[2]+d*Math.sin(s.angle),h=ground(this.night,x,z)
    const old=ground(this.night,s.pos[0],s.pos[2])
    if(Number.isFinite(h)&&!tower(this.night,x,z)&&h<=s.pos[1]+.22){s.pos=[x,Number.isFinite(old)?s.pos[1]+h-old:h,z]}
    this.constrainShade(s)
  }
  private agents(active:boolean){
    const w=this.w,p=w.player
    for(const s of w.shades){
      if(s.state==='spawning')continue
      if(s.state==='stunned'){if(s.push_ticks){s.push_ticks--;this.shadeMove(s,t.pulse_push_m/t.pulse_push_ticks)}continue}
      if(s.state==='recoil'){this.shadeMove(s,2/60);continue}
      const d=planar(s.pos,p.pos)
      s.state=active && d<=(s.state==='chase'?t.release_radius:t.detect_radius)?'chase':'wander'
      if(s.state==='chase')s.angle=angle(s.pos,p.pos)
      else if(w.sim_tick%120===0)s.angle=this.random()*2*Math.PI
      this.shadeMove(s,s.state==='chase'?Math.min(d,this.map.shadeSpeed/HZ):this.map.shadeSpeed/(2*HZ))
    }
    for(const d of w.drifters){
      const dist=planar(d.pos,p.pos)
      if(d.state!=='flee'){
        d.state=active && p.carried>=5 && dist<=15?'chase':'idle'
        if(d.state==='chase')d.angle=angle(d.pos,p.pos)
        else d.angle+=.012
      }
      const step=d.state==='idle'?2/HZ:d.state==='chase'?Math.min(dist,7/HZ):7/HZ
      d.pos[0]+=Math.cos(d.angle)*step;d.pos[2]+=Math.sin(d.angle)*step
    }
    if(!active)return
    for(const d of [...w.drifters].sort(byId))if(d.state==='chase'&&planar(d.pos,p.pos)<=1.2){
      d.stolen=Math.min(3,p.carried);p.carried-=d.stolen;this.flee(d,240)
      this.emit({name:'drifter_steal',data:{drifter_id:d.id,amount:d.stolen,carried:p.carried}})
    }
    if(p.invuln_ticks||w.lanterns.some(l=>l.lit&&planar(l.pos,p.pos)<=t.safe_radius))return
    const s=[...w.shades].sort(byId).find(s=>(s.state==='chase'||s.state==='wander')&&planar(s.pos,p.pos)<=t.shade_hit_radius && Math.abs(p.pos[1]-s.pos[1])<=t.contact_height)
    if(s){
      const dropped=Math.floor(p.carried*t.hit_drop_ratio)
      p.carried-=dropped;p.flames=dec(p.flames);p.invuln_ticks=Math.round(t.invuln_s*HZ)
      this.drop(p.pos,dropped,true);s.state='recoil';s.state_ticks_left=60;s.angle=angle(p.pos,s.pos);this.shadeMove(s,2/60)
      this.emit({name:'player_hit',data:{by:'shade',flames:p.flames,dropped}})
    }
  }
  private spawns(){
    const w=this.w,k=w.sim_tick
    if(this.randomMotes&&k%t.mote_spawn_ticks===0)this.spawnMote()
    if(this.randomShades && k>=300 && (k-300)%this.map.shadeInterval===0){
      for(let i=0;i<(k===300?2:1)&&w.shades.length<this.map.shadeLimit;i++){
        const pos=this.pick(this.map.fog.filter(v=>planar(v,w.player.pos)>=15&&!w.shades.some(s=>planar(v,s.pos)<.1)))
        if(!pos)break
        const id='S'+(++this.sequence.S)
        w.shades.push({id,pos:copy(pos),state:'spawning',state_ticks_left:1,push_ticks:0,angle:this.random()*2*Math.PI})
        this.emit({name:'shade_spawned',data:{id}})
      }
    }
    if(this.randomDrifters && this.night!==1 && k%1200===0 && w.drifters.length<2){
      w.drifters.push({id:'D'+(++this.sequence.D),pos:copy(this.pick(this.map.fog)),state:'idle',state_ticks_left:0,stolen:0,angle:this.random()*2*Math.PI})
    }
  }
  step(input:HeadlessInput=idle()):EngineEvent[]{
    const w=this.w
    this.events=[]
    if(w.state==='won'||w.state==='lost')return this.events
    w.tick++
    if(input.pause){
      w.paused=!w.paused;w.state=w.paused?'paused':'playing'
      this.emit({name:w.paused?'paused':'resumed',data:{}})
    }
    if(w.paused)return this.events
    w.sim_tick++;this.clocks()
    const active=this.movement(input)
    if(active)this.collect(input.interact)
    for(const s of w.shades)this.constrainShade(s)
    if(active && input.pulse)this.pulse()
    this.agents(active);this.spawns()
    if(!w.player.flames)w.state='lost'
    else if(w.lanterns.every(l=>l.lit)){
      w.state='won';w.score+=Math.floor(w.time_left_s)*t.score.per_second_left+w.player.flames*t.score.per_flame_left
    }else if(!this.remaining)w.state='lost'
    if(w.state==='won')this.emit({name:'game_over',data:{result:'won',reason:'all_lit'}})
    if(w.state==='lost')this.emit({name:'game_over',data:{result:'lost',reason:w.player.flames?'dawn':'no_flames'}})
    return this.events
  }
}
