import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CardSkeleton from './CardSkeleton.vue'

describe('CardSkeleton', () => {
  it('stays out of the accessibility tree, holding no task to announce', () => {
    // A shelf draws several of these at once; left visible they would be read
    // out as that many blank cards, which says less than the notice beside them.
    const wrapper = mount(CardSkeleton)

    expect(wrapper.get('[data-skeleton]').attributes('aria-hidden')).toBe('true')
  })

  it('offers nothing to press, since there is no docket behind it yet', () => {
    const wrapper = mount(CardSkeleton)

    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('is not draggable either, unlike the card it stands in for', () => {
    // A gesture started on a placeholder would put nothing in hand, and every
    // tray would then light up for a drag carrying no docket.
    const wrapper = mount(CardSkeleton)

    expect(wrapper.get('[data-skeleton]').attributes('draggable')).toBeUndefined()
  })

  it('is built on the same two-column grid as a real docket', () => {
    // This is the placeholder's whole job: the stub column has to be the same
    // 26px it will be once the cards land, or the stack shifts as they arrive.
    const wrapper = mount(CardSkeleton)

    expect(wrapper.get('[data-skeleton]').classes()).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-[26px_1fr]']),
    )
  })

  it('claims the box the category mark will need, before it is known', () => {
    // Left out, the number below it would sit higher than on a filled card and
    // drop into place on arrival — the jump the placeholder exists to prevent.
    const wrapper = mount(CardSkeleton)

    expect(wrapper.get('[data-skeleton] span').classes()).toEqual(
      expect.arrayContaining(['size-[15px]', 'border-dashed']),
    )
  })
})
