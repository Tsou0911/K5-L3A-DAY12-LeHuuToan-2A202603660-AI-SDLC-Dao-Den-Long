import { number, record } from './contract'
import { fields, vector } from './scenario'
import type { HeadlessInput, InputFrame } from './types'

export const actions = ['jump','interact','pulse','dash','pause'] as const
export function idle(): HeadlessInput {
  return { move: [0,0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false }
}
export function parseInputs(raw: unknown): InputFrame[] {
  let list = raw
  if (!Array.isArray(raw)) {
    const obj = record(raw)
    fields(obj, ['frames'])
    list = obj.frames
  }
  if (!Array.isArray(list)) throw new Error('Expected input frames')
  let previous = -1
  return list.map(item => {
    const frame = record(item)
    fields(frame, ['tick','move','cam_yaw_deg', ...actions])
    const tick = number(frame.tick, 0, true)
    if (tick <= previous) throw new Error('Input ticks must strictly increase')
    previous = tick
    if ('move' in frame) {
      vector(frame.move, 2)
      if ((frame.move as number[]).some(v => Math.abs(v) > 1)) throw new Error('move must be within [-1,1]')
    }
    if ('cam_yaw_deg' in frame) number(frame.cam_yaw_deg)
    for (const key of actions) if (key in frame && typeof frame[key] !== 'boolean') throw new Error('Invalid ' + key)
    return frame as InputFrame
  })
}
export function edgeInput(current: HeadlessInput, previous: HeadlessInput): HeadlessInput {
  const result = { ...current }
  for (const key of actions) result[key] = current[key] && !previous[key]
  return result
}
// Call exactly once per simulation tick in ascending order.
export function playback(frames: InputFrame[]) {
  let index = 0
  let held = idle()
  return (tick: number) => {
    const previous = held
    if (frames[index]?.tick === tick) {
      const {tick: _, ...patch} = frames[index++]
      held = { ...held, ...patch }
    }
    return edgeInput(held, previous)
  }
}
