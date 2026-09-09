import { TASK_RACKS } from '@/const/task'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RackSwitch from './index.vue'

/** What the board hands down while two shelves hold six and three dockets. */
const counts = { open: 6, done: 3 }

/** Mounts the switch with `rackId` on screen. */
function mountSwitch(rackId = 'open') {
  return mount(RackSwitch, { props: { racks: TASK_RACKS, counts, modelValue: rackId } })
}

/**
 * The segment in position `index`. The explicit failure matters, or a switch that
 * rendered nothing would pass every assertion below on `undefined`.
 */
function segmentAt(wrapper: ReturnType<typeof mountSwitch>, index: number) {
  const segment = wrapper.findAll('button')[index]

  if (!segment) {
    throw new Error(`the switch rendered no segment in position ${index}`)
  }

  return segment
}

describe('RackSwitch', () => {
  it('names the pair 架別, so the two segments read as one control', () => {
    const wrapper = mountSwitch()

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('架別')
  })

  it('prints each shelf beside what is on it, in board order', () => {
    const wrapper = mountSwitch()

    // The count belongs in the segment, not only in the tray below: it is what the
    // reader gets about the shelf they are not looking at.
    expect(segmentAt(wrapper, 0).text()).toBe('未完成 6')
    expect(segmentAt(wrapper, 1).text()).toBe('已完成 3')
  })

  it('counts a shelf the board said nothing about as empty', () => {
    const wrapper = mount(RackSwitch, {
      props: { racks: TASK_RACKS, counts: {}, modelValue: 'open' },
    })

    expect(segmentAt(wrapper, 0).text()).toBe('未完成 0')
  })

  it('marks the shelf on screen pressed, and the other one not', () => {
    const wrapper = mountSwitch('done')

    expect(segmentAt(wrapper, 0).attributes('aria-pressed')).toBe('false')
    expect(segmentAt(wrapper, 1).attributes('aria-pressed')).toBe('true')
  })

  it('reports the shelf that was pressed rather than switching itself', async () => {
    const wrapper = mountSwitch('open')

    await segmentAt(wrapper, 1).trigger('click')

    // Still on 未完成: the board owns the choice, and it has not answered yet.
    expect(wrapper.emitted('update:modelValue')).toEqual([['done']])
    expect(segmentAt(wrapper, 1).attributes('aria-pressed')).toBe('false')
  })

  it('reports the shelf already on screen too, so the board never has to guess', async () => {
    const wrapper = mountSwitch('open')

    await segmentAt(wrapper, 0).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['open']])
  })
})
