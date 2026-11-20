import * as THREE from 'three'
import {bridge,terraces as t,islands,rampAngles,type Night} from '../core/islands'
export function terrain(night:Night){
  const group=new THREE.Group(),land=islands[night]
  function add(g:THREE.BufferGeometry,c:number,x:number,y:number,z:number){
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,flatShading:true,side:THREE.DoubleSide}))
    m.position.set(x,y,z);group.add(m);return m
  }
  for(const [x,z,r] of land.discs){
    add(new THREE.CylinderGeometry(r,r*.92,3,96),0xc9b48a,x,-1.51,z)
    add(new THREE.CylinderGeometry(r,r,.06,96),0x2f5d50,x,-.03,z)
    const base=add(new THREE.ConeGeometry(r*.92,9,24),0x51485a,x,-7.5,z);base.rotation.z=Math.PI
  }
  if(night===2)add(new THREE.BoxGeometry(bridge.right-bridge.left,.35,2*bridge.halfWidth),0x6b4a2f,(bridge.right+bridge.left)/2,-.175,0)
  if(night===3){
    add(new THREE.CylinderGeometry(t.summit,t.summit,t.summitHeight,80),0x2f5d50,0,t.summitHeight/2,0)
    add(new THREE.CylinderGeometry(t.towerRadius,t.towerRadius,t.towerHeight,32),0x6b4a2f,0,t.summitHeight+t.towerHeight/2,0)
    const outline=new THREE.Shape()
    outline.absarc(0,0,t.outer,0,Math.PI,false);outline.lineTo(-t.inner,0);outline.absarc(0,0,t.inner,Math.PI,0,true);outline.closePath()
    const tier=add(new THREE.ExtrudeGeometry(outline,{depth:t.height,bevelEnabled:false,curveSegments:48}),0x2f5d50,0,t.height,0)
    tier.rotation.x=Math.PI/2
    for(const degrees of rampAngles){
      const a=degrees*Math.PI/180,run=t.rampFoot-t.outer,center=(t.rampFoot+t.outer)/2
      const ramp=add(new THREE.BoxGeometry(Math.hypot(run,t.height),.1,t.rampWidth),0xc9b48a,center*Math.cos(a),t.height/2-.05,center*Math.sin(a))
      ramp.rotation.order='YXZ';ramp.rotation.y=-a;ramp.rotation.z=-Math.atan2(t.height,run)
    }
  }
  for(const pad of land.pads)add(new THREE.CylinderGeometry(1,1,.16,24),0xf2c14e,pad.pos[0],pad.pos[1]+.04,pad.pos[2])
  return group
}
