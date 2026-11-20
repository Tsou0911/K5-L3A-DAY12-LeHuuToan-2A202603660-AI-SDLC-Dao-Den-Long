import * as THREE from 'three'
import { GameEngine, HZ } from '../core/engine'
import { benchmarkScenario } from '../core/benchmark'
import { terrain } from './terrain'
import { islands,type Night } from '../core/islands'
import { contract } from '../core/contract'
import { gameAudio } from './sound'
import { edgeInput, idle } from '../core/input'
import type { Entity, Snapshot } from '../core/types'
import './style.css'

const el = (id: string) => document.getElementById(id)!
const query=new URLSearchParams(location.search)
const benchmarkMode=query.get('bench')==='1'
const parsedBenchmarkSeed=Number(query.get('seed')??42)
const benchmarkSeed=Number.isSafeInteger(parsedBenchmarkSeed)?parsedBenchmarkSeed:42
const parsedBenchmarkDuration=Number(query.get('duration')??30)
const benchmarkDuration=(Number.isFinite(parsedBenchmarkDuration)&&parsedBenchmarkDuration>0?Math.min(parsedBenchmarkDuration,3600):30)*1000
const renderer = new THREE.WebGLRenderer({canvas: el('world'), antialias: true})
renderer.setPixelRatio(benchmarkMode?1:Math.min(devicePixelRatio, 2))
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
let night:Night=1,total=0,nightsWon=0,scoreSaved=false
const gameSeed=42
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
const lampDetails=new Map<string,{tear:THREE.Mesh;barBackground:THREE.Mesh;barFill:THREE.Mesh}>()
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
const eyeLeft=mesh(new THREE.SphereGeometry(.07,6,6),0x7a3cff)
const eyeRight=eyeLeft.clone()
eyeLeft.name='eye-left';eyeRight.name='eye-right'
eyeLeft.position.set(-.17,.08,.42);eyeRight.position.set(.17,.08,.42)
shadeShape.add(eyeLeft,eyeRight)
function sync(list: Entity[], objects: Map<string, THREE.Mesh>, shape: THREE.Mesh, y: number, stable=false) {
  if(!stable){
    const alive = new Set(list.map(item => item.id))
    for (const [id,m] of objects) if (!alive.has(id)) { scene.remove(m); objects.delete(id) }
  }
  for (const item of list) {
    let m = objects.get(item.id)
    if (!m) { m = shape.clone(); objects.set(item.id,m); scene.add(m) }
    m.position.set(...item.pos)
    m.position.y += y
  }
}
let overhead = false, cameraYaw = 0
type Screen = 'menu' | 'intro' | 'play' | 'pause' | 'settings' | 'result' | 'leaderboard' | 'bench'
let screen: Screen = 'menu'
let settingsFrom: Screen = 'menu'
let shadeNoticeUntil=0
function show(next: Screen) {
  screen = next
  clearInput()
  gameAudio.music(next === 'play')
  el('result').hidden = next === 'play'||next==='bench'
  el('settings').hidden = next !== 'settings'
  el('leaderboard-panel').hidden=next!=='leaderboard'
  const terminal=state.state==='lost'||(state.state==='won'&&night===3)
  el('score-entry').hidden=next!=='result'||!terminal||scoreSaved
  el('leaderboard-open').hidden=next!=='menu'
  el('message').textContent = {menu:'Đảo Đèn Lồng',intro:'Đêm '+night+' · '+islands[night].title,play:'',pause:'Tạm dừng',settings:'Cài đặt',
    result:state.state === 'won' && night===3 ? 'Bình Minh · '+total+' điểm' : state.state === 'won' ? 'Đã giữ đảo sáng đến bình minh · '+state.score+' điểm' : 'Đêm đã khép lại',
    leaderboard:'Bảng xếp hạng',bench:''}[next]
  el('primary').textContent = next === 'pause' ? 'Tiếp tục' : next === 'settings' || next==='leaderboard' ? 'Quay lại' : next === 'intro' ? 'Vào đảo' : 'Bắt đầu'
  if(next==='result')el('primary').textContent='Đêm kế tiếp'
  el('dialog-note').textContent=next==='intro'?['Ông Đăng: Con hãy gom ánh sáng về bến.','Ông Đăng: Qua cầu tre, con sẽ thấy những lá bùa đỏ.','Ông Đăng: Hãy nghe tiếng gió trước khi lên tháp chuông.'][night-1]:''
  el('primary').hidden = next === 'result' && (state.state!=='won'||night===3)
  el('restart').hidden = (next !== 'result' || state.state==='won') && next !== 'pause'
  el('options').hidden = next !== 'menu' && next !== 'pause'
  el('menu').hidden = !['pause','result','leaderboard'].includes(next)
  if(next==='leaderboard')void refreshLeaderboard()
  if(next==='result'){
    el('save-message').textContent=''
    el('score-summary').textContent=`Điểm từ các đêm đã thắng: ${total} · ${nightsWon}/3 đêm`
  }
  if (next === 'play') focusGame()
}
const defaultBindings={
  moveUp:'KeyW',moveLeft:'KeyA',moveDown:'KeyS',moveRight:'KeyD',
  jump:'KeyJ',dash:'ShiftLeft',interact:'KeyE',pulse:'KeyF',pause:'Escape'
}
type Action=keyof typeof defaultBindings
type Bindings=Record<Action,string>
const actionLabels:Record<Action,string>={
  moveUp:'Di chuyển lên',moveLeft:'Di chuyển trái',moveDown:'Di chuyển xuống',moveRight:'Di chuyển phải',
  jump:'Nhảy',dash:'Lướt',interact:'Tương tác',pulse:'Tỏa Sáng',pause:'Tạm dừng'
}
const bindingAliases:Record<Action,string[]>={
  moveUp:['ArrowUp'],moveLeft:['ArrowLeft'],moveDown:['ArrowDown'],moveRight:['ArrowRight'],
  jump:[],dash:['ShiftRight'],interact:[],pulse:['Space'],pause:['KeyP']
}
let bindings:Bindings={...defaultBindings}
let captureAction:Action|null=null
const reduceMotion=el('reduce-motion') as HTMLInputElement
function actionCodes(action:Action){
  return [bindings[action],...(bindings[action]===defaultBindings[action]?bindingAliases[action]:[])]
}
function actionHeld(action:Action){return actionCodes(action).some(code=>keys.has(code))}
function keyLabel(code:string){
  if(code.startsWith('Key'))return code.slice(3)
  if(code.startsWith('Digit'))return code.slice(5)
  return ({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'Shift trái',ShiftRight:'Shift phải',
    Escape:'Esc',Space:'Space',Backspace:'Backspace',Enter:'Enter',Tab:'Tab'} as Record<string,string>)[code]??code
}
function updateBindings(){
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>{
    const action=button.dataset.action as Action
    button.textContent=captureAction===action?'Nhấn phím…':keyLabel(bindings[action])
    button.setAttribute('aria-label',`${actionLabels[action]}: ${captureAction===action?'nhấn phím mới':keyLabel(bindings[action])}`)
  })
  document.querySelectorAll<HTMLElement>('[data-binding]').forEach(key=>{
    const action=key.dataset.binding as Action
    key.textContent=actionCodes(action).map(keyLabel).join(' / ')
  })
}
function refreshControls(set:Set<string>){
  set.clear()
  for(const action of Object.keys(bindings) as Action[])for(const code of actionCodes(action))set.add(code)
  set.add('KeyV')
}
try{
  const saved=localStorage.getItem('island.bindings')
  if(saved){
    const loaded=JSON.parse(saved) as Partial<Bindings>
    const next={...defaultBindings}
    for(const action of Object.keys(defaultBindings) as Action[]){
      if(typeof loaded[action]!=='string'||!loaded[action])throw Error('Thiếu phím cho '+actionLabels[action])
      next[action]=loaded[action]!
    }
    if(new Set(Object.values(next)).size!==Object.keys(defaultBindings).length)throw Error('Có phím bị gán trùng')
    bindings=next
  }
}catch(error){
  el('settings-message').textContent='Không thể đọc cài đặt phím: '+(error instanceof Error?error.message:String(error))
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
  sync(s.motes,motes,moteShape,.55,benchmarkMode)
  sync(s.shades,shades,shadeShape,.7,benchmarkMode)
  for(const shade of s.shades){
    const m=shades.get(shade.id)!
    if(m.userData.shadeState===shade.state)continue
    if(m.material===shadeShape.material)m.material=shadeShape.material.clone()
    ;(m.material as THREE.MeshStandardMaterial).color.setHex(shade.state==='stunned'?0x3a3450:0x120a1a)
    m.userData.shadeState=shade.state
  }
  const shadeAccent=colorblind.checked?0x00b3ff:0x7a3cff
  rim.material.color.setHex(shadeAccent)
  eyeLeft.material.color.setHex(shadeAccent)
  eyeRight.material.color.setHex(shadeAccent)
  const lit=s.lanterns.filter(l=>l.lit).length
  ambient.intensity=.15+.55*s.lanterns.reduce((sum,l)=>sum+l.fuel/contract.tuning.fuel_max,0)/s.lanterns.length
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
      const tear=mesh(new THREE.ConeGeometry(.08,.14,3),0x241d2a);tear.position.set(0,.12,.4);tear.rotation.z=Math.PI;light.add(tear)
      post.add(light,roof)
      const safeRing=mesh(new THREE.RingGeometry(contract.tuning.safe_radius-.05,contract.tuning.safe_radius,80),0xffb347,0x3b2915)
      safeRing.rotation.x=-Math.PI/2;safeRing.position.y=-.99;safeRing.name='zone';post.add(safeRing)
      const barBackground=mesh(new THREE.BoxGeometry(.85,.13,.04),0x211d2b)
      barBackground.position.y=2.1;post.add(barBackground)
      const barFill=mesh(new THREE.BoxGeometry(.79,.07,.05),0xffb347,0xffb347)
      barFill.position.y=2.1;post.add(barFill)
      scene.add(post)
      lamps.set(lamp.id,light)
      lampDetails.set(lamp.id,{tear,barBackground,barFill})
    }
    const mat=light.material as THREE.MeshStandardMaterial
    const blink=reduceMotion.checked||lamp.fuel>=contract.tuning.low_fuel_threshold||Math.floor(s.sim_tick/30)%2===0
    light.visible=!lamp.lit||blink
    light.scale.y=lamp.lit?1:.8
    mat.color.setHex(lamp.lit?0xffb347:0x5b5f6e);mat.emissive.setHex(lamp.lit?0xffb347:0)
    light.children[0].visible=lamp.lit
    const zone=light.parent!.getObjectByName('zone')!
    zone.visible=lamp.lit&&lamp.fuel>=contract.tuning.low_fuel_threshold
    const details=lampDetails.get(lamp.id)!
    details.tear.visible=!lamp.lit
    details.barBackground.visible=lamp.lit&&blink
    details.barFill.visible=lamp.lit&&blink
    const fraction=lamp.fuel/contract.tuning.fuel_max
    details.barFill.scale.x=fraction
    details.barFill.position.x=-.395+.395*fraction
  }
  if(benchmarkMode)return
  el('flames').textContent = String(s.player.flames)
  el('carried').textContent = s.player.carried+' / '+s.player.capacity
  el('score').textContent = String(s.score)
  const sec = Math.ceil(s.time_left_s)
  const urgent=s.time_left_s <= 30
  el('time').textContent = (colorblind.checked&&urgent?'⚠ ':'')+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')
  el('lamps').textContent = lit+' / '+s.lanterns.length+' đèn'
  el('bag').textContent = s.player.carried+' / '+s.player.capacity+'  '+'◆'.repeat(s.player.carried)+'◇'.repeat(s.player.capacity-s.player.carried)
  el('cooldowns').textContent = '↠ Lướt '+(s.player.dash_cd/HZ).toFixed(1)+' s · ✷ Xung '+(s.player.cooldown_ticks/HZ).toFixed(1)+' s'
  el('time').classList.toggle('urgent',urgent)
  const alerts:string[]=[]
  if(s.sim_tick<shadeNoticeUntil)alerts.push('⚠ Bóng Mực xuất hiện')
  if(s.wind.warning&&!s.wind.active)alerts.push('⚠ Gió sắp thổi')
  if(s.wind.active)alerts.push('⚠ Gió đang thổi')
  if(s.time_left_s<=10&&s.time_left_s>0)alerts.push('⚠ Còn '+Math.max(1,sec)+' giây')
  const weak=s.lanterns.filter(l=>l.lit&&l.fuel<contract.tuning.low_fuel_threshold).map(l=>l.id)
  if(weak.length)alerts.push('⚠ Đèn dầu yếu: '+weak.join(', '))
  const alertText=alerts.join(' · '),alertNode=el('alerts')
  if(alertNode.textContent!==alertText)alertNode.textContent=alertText
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
  const target = s.lanterns.filter(l => !l.lit||l.fuel<contract.tuning.fuel_max)
    .sort((a,b)=>rangeTo(a)-rangeTo(b)||a.id.localeCompare(b.id,'en',{numeric:true}))[0]
  el('hint').textContent = target && rangeTo(target)<=contract.tuning.interact_radius
    ? 'E — '+(target.lit?'Châm dầu ('+Math.floor(target.fuel)+'%)':'Thắp đèn ('+target.deposited+'/'+(target.ever_lit?contract.tuning.relight_cost:contract.tuning.lantern_cost)+')') : ''
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
  const shadeBeacon=el('shade-beacon')
  shadeBeacon.hidden=true
  const nearestShade=[...s.shades].sort((a,b)=>rangeTo(a)-rangeTo(b)||a.id.localeCompare(b.id,'en',{numeric:true}))[0]
  if(nearestShade&&screen==='play'){
    const pos=new THREE.Vector3(nearestShade.pos[0],nearestShade.pos[1]+.7,nearestShade.pos[2]).project(camera)
    if(Math.abs(pos.x)>1||Math.abs(pos.y)>1||pos.z>1){
      const direction=Math.atan2(nearestShade.pos[0]-x,-(nearestShade.pos[2]-z))+cameraYaw
      shadeBeacon.style.left=(50+44*Math.sin(direction))+'%'
      shadeBeacon.style.top=(50-37*Math.cos(direction))+'%'
      shadeBeacon.style.transform='translate(-50%,-50%) rotate('+(direction-Math.PI/2)+'rad)'
      shadeBeacon.textContent='➤ '+nearestShade.id
      shadeBeacon.hidden=false
    }
  }
}
const keys = new Set<string>()
const controls = new Set<string>()
refreshControls(controls)
updateBindings()
let engine = new GameEngine(benchmarkMode?benchmarkSeed:gameSeed,benchmarkMode?benchmarkScenario(benchmarkSeed):{},1)
let previous = idle(), accumulator = 0, last = performance.now()
let state = engine.snapshot()
interface LeaderboardEntry{name:string;score:number;nights_won:number;achieved_at:string;seed:number}
let leaderboardEntries:LeaderboardEntry[]=[]
async function refreshLeaderboard(){
  const message=el('leaderboard-message')
  try{
    const response=await fetch('/api/leaderboard')
    const data=await response.json()
    if(!response.ok)throw Error(data.error??'Không đọc được bảng xếp hạng')
    if(!Array.isArray(data.entries))throw Error('Dữ liệu bảng xếp hạng không hợp lệ')
    leaderboardEntries=data.entries
    renderLeaderboard()
    message.textContent=leaderboardEntries.length?'':'Chưa có điểm nào được lưu.'
  }catch(error){
    message.textContent='Không thể tải bảng xếp hạng: '+(error instanceof Error?error.message:String(error))
  }
}
function renderLeaderboard(){
  const list=el('leaderboard-list')
  list.replaceChildren()
  leaderboardEntries.forEach((entry,index)=>{
    const item=document.createElement('li')
    item.textContent=`${entry.name} — ${entry.score} điểm · ${entry.nights_won}/3 đêm`
    item.setAttribute('aria-label',`Hạng ${index+1}: ${entry.name}, ${entry.score} điểm, ${entry.nights_won} đêm thắng`)
    list.append(item)
  })
}
el('save-score').onclick=async()=>{
  const nameInput=el('player-name') as HTMLInputElement
  const message=el('save-message')
  if(!nameInput.checkValidity()){
    message.textContent='Tên phải có 3–12 ký tự A–Z, a–z, 0–9 hoặc _.'
    nameInput.focus()
    return
  }
  const button=el('save-score') as HTMLButtonElement
  button.disabled=true
  try{
    const response=await fetch('/api/leaderboard',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({entry:{name:nameInput.value,score:total,nights_won:nightsWon,achieved_at:new Date().toISOString(),seed:gameSeed}})
    })
    const data=await response.json()
    if(!response.ok)throw Error(data.error??'Không lưu được điểm')
    leaderboardEntries=data.entries
    renderLeaderboard()
    scoreSaved=true
    el('score-entry').hidden=true
    message.textContent='Đã lưu điểm vào bảng xếp hạng.'
  }catch(error){
    message.textContent='Không thể lưu điểm: '+(error instanceof Error?error.message:String(error))
    button.disabled=false
  }
}
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
const colorblind = el('colorblind') as HTMLInputElement
const largeText=el('large-text') as HTMLInputElement
try{
  for(const slider of [volume,sensitivity]){
    slider.value=localStorage.getItem('island.'+slider.id)??'45'
    slider.oninput=()=>{
      localStorage.setItem('island.'+slider.id,slider.value)
      gameAudio.volume(Number(volume.value)/100)
    }
  }
  colorblind.checked=localStorage.getItem('island.colorblind')==='true'
  reduceMotion.checked=localStorage.getItem('island.reduce-motion')==='true'
  largeText.checked=localStorage.getItem('island.large-text')==='true'
}catch(error){
  el('settings-message').textContent='Không thể đọc cài đặt đã lưu: '+(error instanceof Error?error.message:String(error))
}
document.body.classList.toggle('colorblind',colorblind.checked)
document.body.classList.toggle('reduce-motion',reduceMotion.checked)
document.body.classList.toggle('large-text',largeText.checked)
colorblind.onchange=()=>{
  localStorage.setItem('island.colorblind',String(colorblind.checked))
  document.body.classList.toggle('colorblind',colorblind.checked)
}
reduceMotion.onchange=()=>{
  localStorage.setItem('island.reduce-motion',String(reduceMotion.checked))
  document.body.classList.toggle('reduce-motion',reduceMotion.checked)
}
largeText.onchange=()=>{
  localStorage.setItem('island.large-text',String(largeText.checked))
  document.body.classList.toggle('large-text',largeText.checked)
}
document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>{
  button.onclick=()=>{
    captureAction=button.dataset.action as Action
    el('settings-message').textContent=`Nhấn phím mới cho ${actionLabels[captureAction]}`
    updateBindings()
  }
})
window.addEventListener('keydown',event=>{
  if(!captureAction)return
  event.preventDefault()
  event.stopImmediatePropagation()
  if(event.repeat||event.code==='Unidentified')return
  const duplicate=(Object.keys(bindings) as Action[]).find(action=>action!==captureAction&&actionCodes(action).includes(event.code))
  if(event.code==='KeyV'||duplicate){
    el('settings-message').textContent=event.code==='KeyV'?'V đang dùng cho đổi camera':`Phím đã được gán cho ${actionLabels[duplicate!]}`
    return
  }
  try{
    const updated={...bindings,[captureAction]:event.code}
    localStorage.setItem('island.bindings',JSON.stringify(updated))
    bindings=updated
    captureAction=null
    refreshControls(controls)
    updateBindings()
    el('settings-message').textContent='Đã lưu phím điều khiển'
  }catch(error){
    el('settings-message').textContent='Không thể lưu phím: '+(error instanceof Error?error.message:String(error))
  }
},true)
el('reset-bindings').onclick=()=>{
  try{
    localStorage.removeItem('island.bindings')
    bindings={...defaultBindings};captureAction=null
    refreshControls(controls);updateBindings()
    el('settings-message').textContent='Đã khôi phục phím mặc định'
  }catch(error){
    el('settings-message').textContent='Không thể khôi phục phím: '+(error instanceof Error?error.message:String(error))
  }
}
canvas.addEventListener('pointermove', e => {
  if (screen === 'play' && e.buttons === 1) cameraYaw -= e.movementX*Number(sensitivity.value)*.0001
})
let togglePause = false
window.addEventListener('keydown', e => {
  if ((screen === 'play' || screen === 'pause') && actionCodes('pause').includes(e.code)) {
    e.preventDefault()
    if (!e.repeat) togglePause = true
  }
})
el('primary').onclick = () => {
  gameAudio.start(Number(volume.value)/100)
  if (screen === 'settings') show(settingsFrom)
  else if (screen === 'menu') { night=1;total=0;nightsWon=0;scoreSaved=false;show('intro') }
  else if (screen === 'result' && night<3) { night=(night+1) as Night;show('intro') }
  else if (screen === 'intro') restart()
  else if (screen === 'pause') togglePause = true
  else if (screen === 'leaderboard') show('menu')
}
el('options').onclick = () => { settingsFrom = screen; show('settings') }
el('leaderboard-open').onclick=()=>show('leaderboard')
el('menu').onclick = () => show('menu')
function restart() {
  overhead = false
  cameraYaw = 0
  togglePause = false
  scoreSaved=false
  engine = new GameEngine(gameSeed,{},night)
  terrains.forEach((g,i)=>g.visible=i===night-1)
  for(const light of lamps.values())if(light.parent)scene.remove(light.parent)
  lamps.clear()
  lampDetails.clear()
  el('night').textContent='ĐÊM 0'+night
  state = engine.snapshot()
  clearInput()
  focusGame()
  accumulator = 0
  show('play')
  draw(state)
}
el('restart').onclick = restart
if(benchmarkMode){
  document.body.classList.add('benchmark')
  screen='bench'
  el('result').hidden=true
}else show('menu')
function resize() {
  const canvas = renderer.domElement
  renderer.setSize(canvas.clientWidth,canvas.clientHeight,false)
  camera.aspect = canvas.clientWidth/canvas.clientHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize',resize)
resize()
draw(state)
interface BenchmarkWindow extends Window {
  __islandBench?:{
    readyAt:number|null;startAt:number|null;lastAt:number|null;dts:number[]
    result?:{avg_fps:number;p1_low_fps:number;frame_ms_p95:number;frames:number;renderer:string}
  }
}
const benchmarkWindow=window as BenchmarkWindow
if(benchmarkMode)benchmarkWindow.__islandBench={readyAt:null,startAt:null,lastAt:null,dts:[]}
function recordBenchmarkFrame(now:number){
  const sample=benchmarkWindow.__islandBench
  if(!sample||sample.result)return
  if(sample.readyAt===null){sample.readyAt=now;return}
  if(sample.startAt===null){
    if(now-sample.readyAt<3000)return
    sample.startAt=now;sample.lastAt=now
    return
  }
  const end=sample.startAt+benchmarkDuration
  if(now>=end){
    const tail=end-sample.lastAt!
    if(tail>0)sample.dts.push(tail)
    const ordered=[...sample.dts].sort((a,b)=>a-b),frames=ordered.length
    if(!frames)throw Error('Benchmark collected no frames')
    const sum=ordered.reduce((total,dt)=>total+dt,0)
    const lowCount=Math.max(1,Math.ceil(.01*frames))
    const slow=ordered.slice(-lowCount).reduce((total,dt)=>total+dt,0)/lowCount
    sample.result={
      frames,avg_fps:1000*frames/sum,p1_low_fps:1000/slow,
      frame_ms_p95:ordered[Math.ceil(.95*frames)-1],
      renderer:`Three.js r${THREE.REVISION} · ${renderer.capabilities.isWebGL2?'WebGL2':'WebGL'} · ${renderer.getContext().getParameter(renderer.getContext().RENDERER)}`
    }
    return
  }
  sample.dts.push(now-sample.lastAt!)
  sample.lastAt=now
}
renderer.setAnimationLoop(now => {
  if(benchmarkMode){
    accumulator+=Math.max(0,(now-last)/1000)
    last=now
    while(accumulator>=1/HZ){state=engine.benchmarkStep();accumulator-=1/HZ}
    draw(state)
    const start=benchmarkWindow.__islandBench?.readyAt??now
    const angle=-Math.PI*2*((now-start)%15000)/15000
    camera.position.set(30*Math.cos(angle),15,30*Math.sin(angle))
    camera.lookAt(0,0,0)
    camera.updateMatrixWorld()
    renderer.render(scene,camera)
    recordBenchmarkFrame(now)
    return
  }
  accumulator += Math.min((now-last)/1000,.25)
  last = now
  while (accumulator >= 1/HZ) {
    if ((screen === 'play' || screen === 'pause' || (screen==='settings' && settingsFrom==='pause')) && (state.state === 'playing' || state.state==='paused')) {
      const held = idle()
      const right=actionHeld('moveRight'),left=actionHeld('moveLeft')
      const back=actionHeld('moveDown'),forward=actionHeld('moveUp')
      held.move = [Number(right)-Number(left), Number(back)-Number(forward)]
      held.jump=actionHeld('jump')
      held.interact=actionHeld('interact')
      held.pulse=actionHeld('pulse')
      held.cam_yaw_deg = cameraYaw*180/Math.PI
      held.dash=actionHeld('dash')
      const input = edgeInput(held,previous)
      input.pause = togglePause
      togglePause = false
      const events = engine.step(input)
      for (const event of events){
        gameAudio.effect(event.name)
        if(event.name==='shade_spawned')shadeNoticeUntil=state.sim_tick+600
      }
      const before=state
      previous = held
      state = engine.snapshot()
      if(input.jump && before.player.grounded && !state.player.grounded)gameAudio.effect('jump')
      if(!before.wind.warning&&state.wind.warning)gameAudio.effect('wind')
      if(state.time_left_s<=10 && Math.ceil(before.time_left_s)!==Math.ceil(state.time_left_s))gameAudio.effect('countdown')
      if (state.state === 'won' || state.state==='lost') {
        if(state.state==='won'){total+=state.score;nightsWon++}
        gameAudio.effect(state.state);show('result')
      }
      else if (input.pause) show(state.paused ? 'pause' : 'play')
    }
    accumulator -= 1/HZ
  }
  draw(state)
  renderer.render(scene,camera)
})
