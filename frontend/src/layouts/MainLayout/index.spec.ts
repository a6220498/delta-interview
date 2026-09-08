import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MainLayout from './index.vue'

/**
 * The text a screen reader would announce for `element`: its text content with
 * every `aria-hidden` subtree removed, which is how an accessible name gets
 * computed from an element's contents.
 *
 * Vue Test Utils' `.text()` is raw `textContent` and keeps decorative glyphs, so
 * asserting on it would pass a button whose name reads `＋新增工單`.
 */
function accessibleName(element: Element): string {
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll('[aria-hidden="true"]').forEach((decoration) => decoration.remove())
  return clone.textContent?.trim() ?? ''
}

/**
 * The slot cases assert both halves of a placement: the content lands where it
 * belongs *and* does not also show up in the other landmark. Asserting only the
 * first would still pass if the two elements were nested, which would hand a
 * screen reader one landmark instead of two.
 *
 * The fixtures deliberately avoid the words the layout renders by default —
 * slot content reading `看板` would be indistinguishable from the default
 * heading, so a dropped slot would still pass.
 */
describe('MainLayout', () => {
  it('places header slot content in the <header> landmark only', () => {
    const wrapper = mount(MainLayout, {
      slots: { header: '<p>抬頭</p>', default: '<p>單據</p>' },
    })

    expect(wrapper.get('header').text()).toContain('抬頭')
    expect(wrapper.get('main').text()).not.toContain('抬頭')
  })

  it('places default slot content in the <main> landmark only', () => {
    const wrapper = mount(MainLayout, {
      slots: { header: '<p>抬頭</p>', default: '<p>單據</p>' },
    })

    expect(wrapper.get('main').text()).toContain('單據')
    expect(wrapper.get('header').text()).not.toContain('單據')
  })

  describe('content heading', () => {
    it('names the content area in a level-2 heading, so the page outline continues under the masthead', () => {
      const wrapper = mount(MainLayout)

      expect(wrapper.get('main h2').text()).toBe('看板 / Board')
    })

    it('lets the caller retitle it', () => {
      const wrapper = mount(MainLayout, { props: { heading: '封存 / Archive' } })

      expect(wrapper.get('main h2').text()).toBe('封存 / Archive')
    })
  })

  describe('primary action', () => {
    it('labels the action button 新增工單 by default', () => {
      const wrapper = mount(MainLayout)

      // The `＋` is decoration: the name is exactly the label, not `＋新增工單`.
      expect(accessibleName(wrapper.get('button').element)).toBe('新增工單')
    })

    it('lets the caller relabel it', () => {
      const wrapper = mount(MainLayout, { props: { actionLabel: '匯出' } })

      expect(accessibleName(wrapper.get('button').element)).toBe('匯出')
      // Relabelling must not cost the glyph — it is part of the button, not the label.
      expect(wrapper.get('button').text()).toContain('＋')
    })

    it('reports the click rather than deciding what it does', async () => {
      // The layout owns where the button sits, never what pressing it means —
      // that belongs to whoever mounts the layout.
      const wrapper = mount(MainLayout)

      await wrapper.get('button').trigger('click')

      expect(wrapper.emitted('action')).toHaveLength(1)
    })
  })
})
