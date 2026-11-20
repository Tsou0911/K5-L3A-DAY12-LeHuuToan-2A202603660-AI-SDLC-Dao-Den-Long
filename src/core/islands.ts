import type { Vec3 } from './types'
import { contract } from './contract'

export type Night = 1 | 2 | 3
type Disc = [x:number,z:number,r:number]
interface Island {
  title:string; start:Vec3; duration:number; discs:Disc[]; lamps:Vec3[]; motes:Vec3[]; fog:Vec3[]; charms:Vec3[]
  pads:{pos:Vec3; launch:Vec3}[]; shadeInterval:number; shadeLimit:number; shadeSpeed:number
}
const t=contract.tuning
function ring(n:number,r:number,offset=0,x=0,y=0,arc=360): Vec3[] {
  return Array.from({length:n},(_,i)=>{const a=(offset+arc*i/n)*Math.PI/180; return [x+r*Math.cos(a),y,r*Math.sin(a)]})
}
function ferry(x:number,z:number,target:number) {
  const length=Math.hypot(target-x,z)
  return {pos:[x,0,z] as Vec3,launch:[24*(target-x)/length,14,-24*z/length] as Vec3}
}
export const islands:Record<Night,Island>={
  1:{title:'Đảo Bến',start:[0,0,0],duration:t.night1_duration_s,discs:[[0,0,40]],
    lamps:[[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]],
    motes:[...ring(8,12),...ring(16,33)],fog:ring(12,37,15),charms:[],pads:[],shadeInterval:480,shadeLimit:6,shadeSpeed:t.shade_speed},
  2:{title:'Đảo Cau',start:[0,0,0],duration:t.night2_duration_s,discs:[[0,0,28],[70,0,28]],
    lamps:[[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]],
    motes:[0,70].flatMap(x=>[...ring(4,10,0,x),...ring(8,22,0,x)]),fog:[0,70].flatMap(x=>ring(8,26,22.5,x)),
    charms:[[35,0,0]],pads:[ferry(20,18,70),ferry(50,-18,0)],shadeInterval:420,shadeLimit:8,shadeSpeed:t.shade_speed},
  3:{title:'Đảo Chuông',start:[0,6,-5],duration:t.night3_duration_s,discs:[[0,0,45]],
    lamps:[[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]],
    motes:[...ring(18,34),...ring(8,18,20,0,3,160),...ring(4,5,45,0,6)],fog:ring(16,43),
    charms:[[30,0,25],[-30,0,25]],pads:[{pos:[0,3,13],launch:[0,12,-8]}],shadeInterval:360,shadeLimit:10,shadeSpeed:t.shade_speed_night3}
}
export const bridge={left:26,right:44,halfWidth:2}
export const terraces={inner:12,outer:24,height:3,summit:8,summitHeight:6,rampFoot:30,rampWidth:3,towerRadius:2,towerHeight:8}
export const rampAngles=[30,150]
export function ground(night:Night,x:number,z:number):number {
  const r=Math.hypot(x,z)
  if(night===2 && x>=bridge.left && x<=bridge.right && Math.abs(z)<=bridge.halfWidth) return 0
  if(!islands[night].discs.some(([cx,cz,radius])=>Math.hypot(x-cx,z-cz)<=radius)) return -Infinity
  if(night!==3) return 0
  if(r<=terraces.summit) return terraces.summitHeight
  if(r>=terraces.inner && r<=terraces.outer && z>0) return terraces.height
  for(const degrees of rampAngles){
    const a=degrees*Math.PI/180, along=x*Math.cos(a)+z*Math.sin(a), side=z*Math.cos(a)-x*Math.sin(a)
    if(along>=terraces.outer && along<=terraces.rampFoot && Math.abs(side)<=terraces.rampWidth/2) return (terraces.rampFoot-along)*terraces.height/(terraces.rampFoot-terraces.outer)
  }
  return 0
}
export function tower(night:Night,x:number,z:number){return night===3 && Math.hypot(x,z)<terraces.towerRadius}
