import type { Night } from './islands'
export type Vec3 = [number,number,number]
export interface PlayerState {
  pos:Vec3; vel:Vec3; grounded:boolean; carried:number; flames:number; invuln_ticks:number
  cooldown_ticks:number; dash_ticks:number; dash_cd:number; respawn_ticks:number; charm_ticks:number
}
export interface Entity {id:string;pos:Vec3}
export interface MoteState extends Entity {kind:'random'|'dropped';ttl:number}
export interface LanternState extends Entity {deposited:number;lit:boolean}
export type ShadeMode='spawning'|'wander'|'chase'|'recoil'|'stunned'
export interface ShadeState extends Entity {state:ShadeMode;state_ticks_left:number;push_ticks:number;angle:number}
export interface Drifter extends Entity {state:'idle'|'chase'|'flee';stolen:number;state_ticks_left:number;angle:number}
export interface Charm extends Entity {available:boolean;respawn_ticks:number}
export interface Snapshot {
  type:'snapshot';tick:number;sim_tick:number;night:Night;seed:number;paused:boolean;state:'playing'|'won'|'lost'|'paused'
  score:number;time_left_s:number;wind:{active:boolean;dir_deg:number;warning:boolean}
  player:PlayerState;lanterns:LanternState[];motes:MoteState[];shades:ShadeState[];drifters:Drifter[];charms:Charm[]
}
export interface EventData {
  night_start:{night:Night};dash:Record<string,never>;paused:Record<string,never>;resumed:Record<string,never>
  charm_picked:{charm_id:string;charm_ticks:number};drifter_steal:{drifter_id:string;amount:number;carried:number};drifter_drop:{drifter_id:string;amount:number}
  mote_picked:{carried:number};deposit:{lantern_id:string;amount:number;deposited:number};lantern_lit:{lantern_id:string}
  pulse:{stunned_ids:string[]};player_hit:{by:'shade';flames:number;dropped:number}|{by:'fall';flames:number;lost:number;dropped:number}
  shade_spawned:{id:string};game_over:{result:'won';reason:'all_lit'}|{result:'lost';reason:'dawn'|'no_flames'}
}
export type EngineEvent={ [K in keyof EventData]:{type:'event';tick:number;name:K;data:EventData[K]} }[keyof EventData]
export interface Scenario {
  player?:Partial<Pick<PlayerState,'pos'|'vel'|'grounded'|'carried'|'flames'|'invuln_ticks'|'charm_ticks'>> & {dash_cd_ticks?:number;pulse_cd_ticks?:number}
  random_motes?:number|boolean;random_shades?:number|boolean;random_drifters?:boolean;wind_enabled?:boolean
  motes?:(Vec3|Entity)[];shades?:{id?:string;pos:Vec3;stun_ticks?:number;state?:ShadeMode;state_ticks_left?:number}[]
  lanterns?:(Partial<LanternState>&{id:string})[];drifters?:(Partial<Drifter>&{pos:Vec3})[];charms?:(Partial<Charm>&{id:string})[]
  time_left_s?:number
}
export interface HeadlessInput {move:[number,number];cam_yaw_deg:number;jump:boolean;interact:boolean;pulse:boolean;dash:boolean;pause:boolean}
export type InputFrame=Partial<HeadlessInput>&{tick:number}
