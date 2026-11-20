import * as THREE from 'three'
import { GameEngine, HZ, ISLAND_RADIUS } from '../core/engine'
import { edgeInput, idle } from '../core/input'
import type { MoteState, Snapshot } from '../core/types'
import './style.css'

const el = (id: string) => document.getElementById(id)!
const renderer = new THREE.WebGLRenderer({canvas: el('world'), antialias: true})
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x24233f)
scene.fog = new THREE.FogExp2(0x302948, .016)
const camera = new THREE.PerspectiveCamera(48, 1, .1, 160)
scene.add(new THREE.HemisphereLight(0xe2dcff, 0x58405e, 2.4))
const moon = new THREE.DirectionalLight(0xffdcac, 2.1)
moon.position.set(-10,18,4)
scene.add(moon)

function mesh(geometry: THREE.BufferGeometry, color: number, glow = 0) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color,emissive: glow,flatShading:true}))
}
const island = mesh(new THREE.CylinderGeometry(ISLAND_RADIUS,12,3,60),0x415657)
island.position.y = -1.5
scene.add(island)
const rock = mesh(new THREE.ConeGeometry(12,8,14),0x45394d)
rock.rotation.z = Math.PI
rock.position.y = -7
scene.add(rock)
const orb = new THREE.IcosahedronGeometry(1,1)
for (let i=0;i<28;i++) {
  const cloud = mesh(orb,0x807895)
  const a = i*2.4, r = 22+(i%5)*4
  cloud.scale.set(4+i%3,1,2.5)
  cloud.position.set(Math.cos(a)*r,-4-(i%4),Math.sin(a)*r)
  scene.add(cloud)
}
// Mây wears a saffron cloak and a broad travelling hat.
const keeper = new THREE.Group()
const cloak = mesh(new THREE.ConeGeometry(.48,1,8),0xda7045)
cloak.position.y = .55
const head = mesh(orb,0xeac19e)
head.scale.setScalar(.27)
head.position.y = 1.15
const hat = mesh(new THREE.ConeGeometry(.49,.36,10),0xf9ca78)
hat.position.y = 1.48
keeper.add(cloak,head,hat)
scene.add(keeper)
const lamps = new Map<string,THREE.Mesh>()
const motes = new Map<string,THREE.Mesh>()
const shades = new Map<string,THREE.Mesh>()
const moteShape = mesh(new THREE.OctahedronGeometry(.18),0xffda71,0xffa32b)
const shadeShape = mesh(orb,0x291a39,0x1a0929)
shadeShape.scale.set(.55,.8,.55)
function sync(list: MoteState[], objects: Map<string, THREE.Mesh>, shape: THREE.Mesh, y: number) {
  const alive = new Set(list.map(item => item.id))
  for (const [id,m] of objects) if (!alive.has(id)) { scene.remove(m); objects.delete(id) }
  for (const item of list) {
    let m = objects.get(item.id)
    if (!m) { m = shape.clone(); objects.set(item.id,m); scene.add(m) }
    m.position.set(...item.pos)
    m.position.y += y
  }
}
function draw(s: Snapshot) {
  keeper.position.set(...s.player.pos)
  keeper.visible = !s.player.invuln_ticks || Math.floor(s.tick/5)%2 === 0
  sync(s.motes,motes,moteShape,.55)
  sync(s.shades,shades,shadeShape,.7)
  for (const lamp of s.lanterns) {
    let light = lamps.get(lamp.id)
    if (!light) {
      const post = mesh(new THREE.CylinderGeometry(.13,.17,2,8),0x493735)
      post.position.set(lamp.pos[0],lamp.pos[1]+1,lamp.pos[2])
      light = mesh(new THREE.CylinderGeometry(.45,.39,.72,8),0xffc07c)
      light.position.y = 1.02
      const roof = mesh(new THREE.ConeGeometry(.61,.38,8),0x5c3c49)
      roof.position.y = 1.55
      post.add(light,roof)
      scene.add(post)
      lamps.set(lamp.id,light)
    }
    ;(light.material as THREE.MeshStandardMaterial).emissive.setHex(lamp.lit ? 0xffa62c : 0x4c2418)
  }
  el('flames').textContent = String(s.player.flames)
  el('carried').textContent = String(s.player.carried)
  el('score').textContent = String(s.score)
  const sec = Math.ceil(s.time_left_s)
  el('time').textContent = Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')
  el('lamps').textContent = s.lanterns.map(l => l.lit ? '◆' : '◇').join(' ')
  el('result').hidden = s.state === 'playing'
  el('message').textContent = s.state === 'won' ? 'Đảo đã sáng đèn' : 'Đêm đã khép lại'
  const [x,,z] = s.player.pos
  camera.position.set(x*.55,16,z*.55+19)
  camera.lookAt(x*.55,0,z*.55)
}
const keys = new Set<string>()
const controls = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','KeyJ','KeyE','KeyF','Space'])
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
  if (state.state !== 'playing' || document.hidden || !controls.has(e.code)) return
  e.preventDefault()
  if (!e.repeat) keys.add(e.code)
})
window.addEventListener('keyup', e => {
  if (e.target === canvas && state.state === 'playing' && controls.has(e.code)) e.preventDefault()
  keys.delete(e.code)
}, true)
canvas.addEventListener('blur', clearInput)
window.addEventListener('blur', clearInput)
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput() })
focusGame()
el('restart').onclick = () => {
  engine = new GameEngine(42)
  state = engine.snapshot()
  clearInput()
  focusGame()
  accumulator = 0
  draw(state)
}
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
    if (state.state === 'playing') {
      const held = idle()
      const right = keys.has('KeyD') || keys.has('ArrowRight')
      const left = keys.has('KeyA') || keys.has('ArrowLeft')
      const back = keys.has('KeyS') || keys.has('ArrowDown')
      const forward = keys.has('KeyW') || keys.has('ArrowUp')
      held.move = [Number(right)-Number(left), Number(back)-Number(forward)]
      held.jump = keys.has('KeyJ')
      held.interact = keys.has('KeyE')
      held.pulse = keys.has('KeyF') || keys.has('Space')
      engine.step(edgeInput(held,previous))
      previous = held
      state = engine.snapshot()
    }
    accumulator -= 1/HZ
  }
  draw(state)
  renderer.render(scene,camera)
})
