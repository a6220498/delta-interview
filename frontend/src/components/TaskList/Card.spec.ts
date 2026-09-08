import type { Task } from '@/types/task'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Card from './Card.vue'
import RowMenu from './RowMenu.vue'

/**
 * The top layer, stood in for.
 *
 * jsdom 30 has no popover support, so the panel the card opens would throw as it
 * mounted. What the panel does with these two methods is `./RowMenu.spec.ts`'s
 * business; what is under test here is the card's half of the wiring — when a
 * panel exists at all, and what the card does with what it reports.
 */
const showing = new WeakSet<HTMLElement>()

beforeEach(() => {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement): void {
    showing.add(this)
  }

  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement): void {
    showing.delete(this)
  }
})

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
})

enableAutoUnmount(afterEach)

/**
 * Builds a task fixture.
 *
 * The due dates used here are pinned far from any date the suite could
 * plausibly run on — the card reads the real clock to decide "overdue", and a
 * fixture dated near today would start failing on some particular morning.
 */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定，讓 5173 打得到 8080',
    description: null,
    completed: false,
    dueDate: '2099-09-07',
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

const LONG_PAST = '2020-01-04'

/**
 * Mounts a card in the document itself, rather than in a detached fragment.
 *
 * The row menu is a popover, and a popover has to be in the page to be shown at
 * all — so every test that opens one mounts through here.
 */
function mountAttached(subject: Task = task()) {
  return mount(Card, { props: { task: subject }, attachTo: document.body })
}

describe('Card', () => {
  it('prints the number a person reads off the stub', () => {
    const wrapper = mount(Card, { props: { task: task() } })

    expect(wrapper.text()).toContain('bug-0012')
  })

  it('prints the title', () => {
    const wrapper = mount(Card, { props: { task: task({ title: '寫契約' }) } })

    expect(wrapper.text()).toContain('寫契約')
  })

  it('keeps the category mark out of the accessibility tree, the number already carries it', () => {
    const wrapper = mount(Card, { props: { task: task() } })

    // "bug-0012" is announced in full, so a screen reader hearing the mark as
    // well would be told the category twice.
    expect(wrapper.get('[data-category]').attributes('aria-hidden')).toBe('true')
  })

  describe('due date', () => {
    it('shows the day the task is due', () => {
      const wrapper = mount(Card, { props: { task: task() } })

      expect(wrapper.text()).toContain('09/07')
    })

    it('says 無期限 when there is no deadline', () => {
      const wrapper = mount(Card, { props: { task: task({ dueDate: null }) } })

      expect(wrapper.text()).toContain('無期限')
    })

    it('labels an overdue task in text, not only in red', () => {
      // The spec sets this word in CSS `content`, which assistive tech is not
      // required to announce. Colour plus a decorative glyph would leave the
      // one state that costs the user something invisible to a screen reader.
      const wrapper = mount(Card, { props: { task: task({ dueDate: LONG_PAST }) } })

      expect(wrapper.text()).toContain('逾期')
    })

    it('drops the overdue label once the task is stamped', () => {
      const wrapper = mount(Card, { props: { task: task({ dueDate: LONG_PAST, completed: true }) } })

      expect(wrapper.text()).not.toContain('逾期')
    })
  })

  describe('completion mark', () => {
    it('reports the current state as a pressed toggle', () => {
      const open = mount(Card, { props: { task: task() } })
      const done = mount(Card, { props: { task: task({ completed: true }) } })

      expect(open.get('[aria-pressed]').attributes('aria-pressed')).toBe('false')
      expect(done.get('[aria-pressed]').attributes('aria-pressed')).toBe('true')
    })

    it('names both the state and what pressing will do', () => {
      const wrapper = mount(Card, { props: { task: task() } })

      expect(wrapper.get('[aria-pressed]').attributes('aria-label')).toBe(
        '狀態：未完成，按下標記為已完成',
      )
    })

    it('asks for an explicit target state rather than a toggle', async () => {
      // The contract's completion endpoint takes a boolean on purpose: two fast
      // clicks must not race to an unpredictable result. The card emits the
      // state it wants, so the second click asks for the same thing as the first.
      const wrapper = mount(Card, { props: { task: task({ completed: false }) } })

      await wrapper.get('[aria-pressed]').trigger('click')

      expect(wrapper.emitted('toggle')).toEqual([[true]])
    })

    it('asks to reopen a task that is already done', async () => {
      const wrapper = mount(Card, { props: { task: task({ completed: true }) } })

      await wrapper.get('[aria-pressed]').trigger('click')

      expect(wrapper.emitted('toggle')).toEqual([[false]])
    })
  })

  describe('done state', () => {
    it('stamps the card so completion is a shape on the page, not just a colour', () => {
      const wrapper = mount(Card, { props: { task: task({ completed: true }) } })

      expect(wrapper.text()).toContain('完成 DONE')
    })

    it('leaves an open card unstamped', () => {
      const wrapper = mount(Card, { props: { task: task() } })

      expect(wrapper.text()).not.toContain('完成 DONE')
    })
  })

  describe('row menu', () => {
    it('names which task the menu belongs to', () => {
      // The menu opens in the top layer, visually detached from its card; the
      // number is what ties the two back together.
      const wrapper = mount(Card, { props: { task: task() } })

      expect(wrapper.get('[aria-haspopup]').attributes('aria-label')).toBe('bug-0012 的操作選單')
    })

    it('keeps the panel out of the page until the button is pressed', () => {
      // Closed is no panel rather than a hidden one, so a shelf of dockets
      // carries nothing per card waiting to be shown.
      const wrapper = mountAttached()

      expect(wrapper.findComponent(RowMenu).exists()).toBe(false)
    })

    it('hangs the panel from the button that was pressed', async () => {
      // The panel is placed by measuring against that button, so it is handed
      // the element rather than left to find it.
      const wrapper = mountAttached()
      const button = wrapper.get('[aria-haspopup]')

      await button.trigger('click')

      expect(wrapper.findComponent(RowMenu).props('anchor')).toBe(button.element)
    })

    it('takes the panel away when its own button is pressed again', async () => {
      // The button is a switch. The browser dismisses the panel on pointerdown,
      // before the click that would put it straight back up, so the panel says
      // on its way out that its own button is what took it.
      const wrapper = mountAttached()
      const button = wrapper.get('[aria-haspopup]')

      await button.trigger('click')
      wrapper.findComponent(RowMenu).vm.$emit('close', true)
      await nextTick()
      await button.trigger('click')

      expect(wrapper.findComponent(RowMenu).exists()).toBe(false)
    })

    it('opens again after a dismissal that came from somewhere else', async () => {
      // Esc, a press elsewhere on the board, or an entry chosen with the mouse.
      // None of those may cost the button its next press.
      const wrapper = mountAttached()
      const button = wrapper.get('[aria-haspopup]')

      await button.trigger('click')
      wrapper.findComponent(RowMenu).vm.$emit('close', false)
      await nextTick()
      await button.trigger('click')

      expect(wrapper.findComponent(RowMenu).exists()).toBe(true)
    })

    it('passes 編輯 up, because the sheet belongs to the board', async () => {
      const wrapper = mountAttached()

      await wrapper.get('[aria-haspopup]').trigger('click')
      wrapper.findComponent(RowMenu).vm.$emit('edit')

      expect(wrapper.emitted('edit')).toHaveLength(1)
    })

    it('passes 刪除 up the same way', async () => {
      const wrapper = mountAttached()

      await wrapper.get('[aria-haspopup]').trigger('click')
      wrapper.findComponent(RowMenu).vm.$emit('delete')

      expect(wrapper.emitted('delete')).toHaveLength(1)
    })
  })
})
