import * as THREE from 'three'
import { GameEngine, HZ } from '../core/engine'
import { terrain } from './terrain'
import { islands,type Night } from '../core/islands'
import { contract } from '../core/contract'
import { gameAudio } from './sound'
import { edgeInput, idle } from '../core/input'
import type { Entity, Snapshot } from '../core/types'
import './style.css'

const el = (id: string) => document.getElementById(id)!
const renderer = new THREE.WebGLRenderer({canvas: el('world'), antialias: true})
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e1430)
scene.fog = new THREE.FogExp2(0x1b2350, .016)
const camera = new THREE.PerspectiveCamera(48, 1, .1, 160)
const ambient=new THREE.HemisphereLight(0xffffff,0x58405e,.15)
scene.add(ambient)
const moon = new THREE.DirectionalLight(0xffdcac, 2.1)
moon.position.set(-10,18,4)
scene.add(moon)

function mesh(geometry: THREE.BufferGeometry, color: number, glow = 0) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color,emissive: glow,flatShading:true}))
}
let night:Night=1, total=0
const terrains=[terrain(1),terrain(2),terrain(3)]
scene.add(...terrains)
terrains.forEach((g,i)=>g.visible=i===0)
const ray=new THREE.Raycaster()
const orb = new THREE.IcosahedronGeometry(1,1)
for (let i=0;i<28;i++) {
  const cloud = mesh(orb,0x12384a)
  const a = i*2.4, r = 22+(i%5)*4
  cloud.scale.set(4+i%3,1,2.5)
  cloud.position.set(Math.cos(a)*r,-4-(i%4),Math.sin(a)*r)
  scene.add(cloud)
}
// Mây wears a saffron cloak and a broad travelling hat.
const keeper = new THREE.Group()
const cloak = mesh(new THREE.ConeGeometry(.48,1,8),0xe8e2d0)
cloak.position.y = .55
const head = mesh(orb,0xeac19e)
head.scale.setScalar(.27)
head.position.y = 1.15
const hat = mesh(new THREE.ConeGeometry(.49,.36,10),0xf9ca78)
hat.position.y = 1.48
const scarf=mesh(new THREE.CylinderGeometry(.25,.29,.14,10),0xc8102e)
scarf.position.y=.95
keeper.add(cloak,head,hat,scarf)
scene.add(keeper)
const lamps = new Map<string,THREE.Mesh>()
const motes = new Map<string,THREE.Mesh>()
const shades = new Map<string,THREE.Mesh>()
const moteShape = mesh(new THREE.OctahedronGeometry(.18),0xfff6c2,0xffe58a)
const halo=mesh(new THREE.OctahedronGeometry(.27),0xffe58a,0xffe58a)
halo.material.transparent=true;halo.material.opacity=.20;halo.material.depthWrite=false;moteShape.add(halo)
const shadeShape = mesh(orb,0x120a1a,0x120a1a)
shadeShape.scale.set(.55,.8,.55)
const charms=new Map<string,THREE.Mesh>(),drifters=new Map<string,THREE.Mesh>()
const charmShape=mesh(new THREE.BoxGeometry(.45,.7,.09),0xc8102e)
const trim=mesh(new THREE.BoxGeometry(.5,.75,.06),0xf2c14e);charmShape.add(trim)
const ribbon=new THREE.PlaneGeometry(1.7,.35,12,1)
const ribbonPos=ribbon.getAttribute('position')
for(let i=0;i<ribbonPos.count;i++)ribbonPos.setZ(i,Math.sin(ribbonPos.getX(i)*5)*.2)
ribbon.computeVertexNormals()
const silk=mesh(ribbon,0x8fa3b8);silk.material.side=THREE.DoubleSide
const leaves=Array.from({length:9},()=>{const leaf=mesh(new THREE.OctahedronGeometry(.22),0xc9b48a);leaf.scale.set(1,.22,.55);scene.add(leaf);return leaf})
const rim=mesh(orb,0x7a3cff);rim.scale.setScalar(1.07);rim.material.side=THREE.BackSide;shadeShape.add(rim)
function sync(list: Entity[], objects: Map<string, THREE.Mesh>, shape: THREE.Mesh, y: number) {
  const alive = new Set(list.map(item => item.id))
  for (const [id,m] of objects) if (!alive.has(id)) { scene.remove(m); objects.delete(id) }
  for (const item of list) {
    let m = objects.get(item.id)
    if (!m) { m = shape.clone(); objects.set(item.id,m); scene.add(m) }
    m.position.set(...item.pos)
    m.position.y += y
  }
}
let overhead = false, cameraYaw = 0
type Screen = 'menu' | 'intro' | 'play' | 'pause' | 'settings' | 'result'
let screen: Screen = 'menu'
let settingsFrom: Screen = 'menu'
function show(next: Screen) {
  screen = next
  clearInput()
  gameAudio.music(next === 'play')
  el('result').hidden = next === 'play'
  el('settings').hidden = next !== 'settings'
  el('message').textContent = {menu:'Đảo Đèn Lồng',intro:'Đêm '+night+' · '+islands[night].title,play:'',pause:'Tạm dừng',settings:'Cài đặt',
    result:state.state === 'won' && night===3 ? 'Bình Minh · '+total+' điểm' : state.state === 'won' ? 'Đảo đã sáng đèn · '+state.score+' điểm' : 'Đêm đã khép lại'}[next]
  el('primary').textContent = next === 'pause' ? 'Tiếp tục' : next === 'settings' ? 'Quay lại' : next === 'intro' ? 'Vào đảo' : 'Bắt đầu'
  if(next==='result')el('primary').textContent='Đêm kế tiếp'
  el('dialog-note').textContent=next==='intro'?['Ông Đăng: Con hãy gom ánh sáng về bến.','Ông Đăng: Qua cầu tre, con sẽ thấy những lá bùa đỏ.','Ông Đăng: Hãy nghe tiếng gió trước khi lên tháp chuông.'][night-1]:''
  el('primary').hidden = next === 'result' && (state.state!=='won'||night===3)
  el('restart').hidden = (next !== 'result' || state.state==='won') && next !== 'pause'
  el('options').hidden = next !== 'menu' && next !== 'pause'
  el('menu').hidden = next !== 'pause' && next !== 'result'
  if (next === 'play') focusGame()
}
function draw(s: Snapshot) {
  keeper.position.set(...s.player.pos)
  keeper.visible = !s.player.respawn_ticks && (!s.player.invuln_ticks || Math.floor(s.sim_tick/5)%2 === 0)
  const windAngle=s.wind.dir_deg*Math.PI/180
  leaves.forEach((leaf,i)=>{
    leaf.visible=s.wind.warning || s.wind.active
    if(!leaf.visible)return
    const along=(s.sim_tick*.09+i*2.1)%12-6,side=i%5-2
    leaf.position.set(s.player.pos[0]+along*Math.cos(windAngle)-side*Math.sin(windAngle),s.player.pos[1]+1.4+Math.sin(i+s.sim_tick*.05),s.player.pos[2]+along*Math.sin(windAngle)+side*Math.cos(windAngle))
    leaf.rotation.y=s.sim_tick*.08+i
  })
  sync(s.charms.filter(c=>c.available),charms,charmShape,.65)
  sync(s.drifters,drifters,silk,.9)
  sync(s.motes,motes,moteShape,.55)
  sync(s.shades,shades,shadeShape,.7)
  for(const shade of s.shades){
    const m=shades.get(shade.id)!
    if(m.material===shadeShape.material)m.material=shadeShape.material.clone()
    ;(m.material as THREE.MeshStandardMaterial).color.setHex(shade.state==='stunned'?0x3a3450:0x120a1a)
  }
  const lit=s.lanterns.filter(l=>l.lit).length
  ambient.intensity=.15+.55*lit/s.lanterns.length
  for (const lamp of s.lanterns) {
    let light = lamps.get(lamp.id)
    if (!light) {
      const post = mesh(new THREE.CylinderGeometry(.13,.17,2,8),0x6b4a2f)
      post.position.set(lamp.pos[0],lamp.pos[1]+1,lamp.pos[2])
      light = mesh(new THREE.CylinderGeometry(.45,.39,.72,8),0x5b5f6e)
      light.position.y = 1.02
      const roof = mesh(new THREE.ConeGeometry(.61,.38,8),0x5c3c49)
      roof.position.y = 1.55
      const core=mesh(new THREE.SphereGeometry(.24,8,6),0xffe9b0,0xffe9b0);core.position.y=-.31;light.add(core)
      post.add(light,roof)
      const safeRing=mesh(new THREE.RingGeometry(contract.tuning.safe_radius-.05,contract.tuning.safe_radius,80),0xffb347,0x3b2915)
      safeRing.rotation.x=-Math.PI/2;safeRing.position.y=-.99;safeRing.name='zone';post.add(safeRing)
      scene.add(post)
      lamps.set(lamp.id,light)
    }
    const mat=light.material as THREE.MeshStandardMaterial
    mat.color.setHex(lamp.lit?0xffb347:0x5b5f6e);mat.emissive.setHex(lamp.lit?0xffb347:0)
    light.children[0].visible=lamp.lit
    light.parent!.getObjectByName('zone')!.visible=lamp.lit
  }
  el('flames').textContent = String(s.player.flames)
  el('carried').textContent = String(s.player.carried)
  el('score').textContent = String(s.score)
  const sec = Math.ceil(s.time_left_s)
  el('time').textContent = Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')
  el('lamps').textContent = lit+' / '+s.lanterns.length+' đèn'
  el('bag').textContent = '◆'.repeat(s.player.carried)+'◇'.repeat(contract.tuning.carry_capacity-s.player.carried)
  el('cooldowns').textContent = '↠ Lướt '+(s.player.dash_cd/HZ).toFixed(1)+' s · ✷ Xung '+(s.player.cooldown_ticks/HZ).toFixed(1)+' s'
  el('time').classList.toggle('urgent',s.time_left_s <= 30)
  const [x,y,z] = s.player.pos
  const h = Math.max(0,y)
  const range = overhead ? .01 : 11
  camera.position.set(x+Math.sin(cameraYaw)*range,h+(overhead ? 36 : 6),z+Math.cos(cameraYaw)*range)
  const targetPos=new THREE.Vector3(x,h+.8,z),arm=camera.position.clone().sub(targetPos)
  ray.set(targetPos,arm.clone().normalize());ray.far=arm.length()
  const obstacle=ray.intersectObjects(terrains[night-1].children,false)[0]
  if(obstacle)camera.position.copy(targetPos).addScaledVector(ray.ray.direction,Math.max(.15,obstacle.distance-.2))
  camera.lookAt(targetPos)
  camera.updateMatrixWorld()
  const rangeTo = (l: Entity) => Math.hypot(l.pos[0]-x,l.pos[2]-z)
  const target = s.lanterns.filter(l => !l.lit).sort((a,b)=>rangeTo(a)-rangeTo(b))[0]
  el('hint').textContent = target && rangeTo(target)<=contract.tuning.interact_radius ? 'E — Nạp ánh sáng ('+target.deposited+'/'+contract.tuning.lantern_cost+')' : ''
  const beacon = el('beacon')
  beacon.hidden = true
  if (target && screen === 'play') {
    const pos = new THREE.Vector3(...target.pos).project(camera)
    if (Math.abs(pos.x)>1 || Math.abs(pos.y)>1 || pos.z>1) {
      const angle = Math.atan2(target.pos[0]-x,-(target.pos[2]-z))+cameraYaw
      beacon.style.left = (50+44*Math.sin(angle))+'%'
      beacon.style.top = (50-37*Math.cos(angle))+'%'
      beacon.textContent = '➤ '+target.id
      beacon.style.transform = 'translate(-50%,-50%) rotate('+(angle-Math.PI/2)+'rad)'
      beacon.hidden = false
    }
  }
}
const keys = new Set<string>()
const controls = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyJ','KeyE','KeyF','Space','ShiftLeft','ShiftRight','KeyV'])
let engine = new GameEngine(42), previous = idle(), accumulator = 0, last = performance.now()
let state = engine.snapshot()
const canvas = renderer.domElement
canvas.tabIndex = 0
function focusGame() {
  canvas.focus({preventScroll: true})
}
function clearInput() {
  keys.clear()
  previous = idle()
}
canvas.addEventListener('pointerdown', focusGame)
canvas.addEventListener('keydown', e => {
  if (screen !== 'play' || state.state !== 'playing' || document.hidden || !controls.has(e.code)) return
  e.preventDefault()
  if (e.code === 'KeyV') { if (!e.repeat) overhead = !overhead; return }
  if (!e.repeat) keys.add(e.code)
})
window.addEventListener('keyup', e => {
  if (e.target === canvas && state.state === 'playing' && controls.has(e.code)) e.preventDefault()
  keys.delete(e.code)
}, true)
canvas.addEventListener('blur', clearInput)
window.addEventListener('blur', clearInput)
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput() })
const volume = el('volume') as HTMLInputElement
const sensitivity = el('sensitivity') as HTMLInputElement
for (const slider of [volume,sensitivity]) {
  slider.value = localStorage.getItem('island.'+slider.id) ?? '45'
  slider.oninput = () => {
    localStorage.setItem('island.'+slider.id,slider.value)
    gameAudio.volume(Number(volume.value)/100)
  }
}
canvas.addEventListener('pointermove', e => {
  if (screen === 'play' && e.buttons === 1) cameraYaw -= e.movementX*Number(sensitivity.value)*.0001
})
let togglePause = false
window.addEventListener('keydown', e => {
  if ((screen === 'play' || screen === 'pause') && (e.code === 'Escape' || e.code === 'KeyP')) {
    e.preventDefault()
    if (!e.repeat) togglePause = true
  }
})
el('primary').onclick = () => {
  gameAudio.start(Number(volume.value)/100)
  if (screen === 'settings') show(settingsFrom)
  else if (screen === 'menu') { night=1;total=0;show('intro') }
  else if (screen === 'result' && night<3) { night=(night+1) as Night;show('intro') }
  else if (screen === 'intro') restart()
  else if (screen === 'pause') togglePause = true
}
el('options').onclick = () => { settingsFrom = screen; show('settings') }
el('menu').onclick = () => show('menu')
function restart() {
  overhead = false
  cameraYaw = 0
  togglePause = false
  engine = new GameEngine(42,{},night)
  terrains.forEach((g,i)=>g.visible=i===night-1)
  for(const light of lamps.values())if(light.parent)scene.remove(light.parent)
  lamps.clear()
  el('night').textContent='ĐÊM 0'+night
  state = engine.snapshot()
  clearInput()
  focusGame()
  accumulator = 0
  show('play')
  draw(state)
}
el('restart').onclick = restart
show('menu')
function resize() {
  const canvas = renderer.domElement
  renderer.setSize(canvas.clientWidth,canvas.clientHeight,false)
  camera.aspect = canvas.clientWidth/canvas.clientHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize',resize)
resize()
draw(state)
renderer.setAnimationLoop(now => {
  accumulator += Math.min((now-last)/1000,.25)
  last = now
  while (accumulator >= 1/HZ) {
    if ((screen === 'play' || screen === 'pause' || (screen==='settings' && settingsFrom==='pause')) && (state.state === 'playing' || state.state==='paused')) {
      const held = idle()
      const right = keys.has('KeyD') || keys.has('ArrowRight')
      const left = keys.has('KeyA') || keys.has('ArrowLeft')
      const back = keys.has('KeyS') || keys.has('ArrowDown')
      const forward = keys.has('KeyW') || keys.has('ArrowUp')
      held.move = [Number(right)-Number(left), Number(back)-Number(forward)]
      held.jump = keys.has('KeyJ')
      held.interact = keys.has('KeyE')
      held.pulse = keys.has('KeyF') || keys.has('Space')
      held.cam_yaw_deg = cameraYaw*180/Math.PI
      held.dash = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const input = edgeInput(held,previous)
      input.pause = togglePause
      togglePause = false
      const events = engine.step(input)
      for (const event of events) gameAudio.effect(event.name)
      const before=state
      previous = held
      state = engine.snapshot()
      if(input.jump && before.player.grounded && !state.player.grounded)gameAudio.effect('jump')
      if(!before.wind.warning&&state.wind.warning)gameAudio.effect('wind')
      if(state.time_left_s<=10 && Math.ceil(before.time_left_s)!==Math.ceil(state.time_left_s))gameAudio.effect('countdown')
      if (state.state === 'won' || state.state==='lost') { if(state.state==='won')total+=state.score;gameAudio.effect(state.state);show('result') }
      else if (input.pause) show(state.paused ? 'pause' : 'play')
    }
    accumulator -= 1/HZ
  }
  draw(state)
  renderer.render(scene,camera)
})
