import type { TaskSummary } from '@/types/task'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RowMenu from './RowMenu.vue'

/**
 * The top layer, stood in for.
 *
 * jsdom 30 has no popover support at all — `showPopover` is not a function, so
 * the panel would throw as it mounted — and it lays nothing out, so every box
 * measured below is one this file put there. What is testable here is the
 * component's own arithmetic and the events it sends; the light dismiss, the
 * Esc key and the focus handed back to the three-dot button are the browser's,
 * and are exactly why the panel is a native popover rather than a div.
 */
const showing = new WeakSet<HTMLElement>()

/** The event a browser dispatches on a popover that has just changed state. */
function toggleEvent(newState: 'open' | 'closed'): Event {
  const event = new Event('toggle')

  // Defined rather than passed to a constructor: jsdom has no `ToggleEvent`.
  Object.defineProperty(event, 'newState', { value: newState })

  return event
}

/** A box with every field, so the component can read whichever it likes. */
function rectOf(box: Partial<DOMRect>): DOMRect {
  const empty = { x: 0, y: 0, top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 }

  return { ...empty, ...box, toJSON: () => empty } as DOMRect
}

/** The panel's own measurements, the same for every test that places one. */
const PANEL = { width: 148, height: 130 }

/** A three-dot button sitting in the middle of the window. */
const BUTTON = { top: 100, bottom: 126, left: 374, right: 400, width: 26, height: 26 }

beforeEach(() => {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement): void {
    showing.add(this)
  }

  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement): void {
    if (!showing.has(this)) {
      return
    }

    showing.delete(this)
    this.dispatchEvent(toggleEvent('closed'))
  }

  // The panel's box. An anchor gets its own stub below, which shadows this one.
  HTMLElement.prototype.getBoundingClientRect = () => rectOf(PANEL)

  // Written out rather than taken from jsdom's defaults, so the placement
  // figures below are read against a window this file states the size of.
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
})

enableAutoUnmount(afterEach)

/** The buttons made below, cleared out between tests. */
const anchors: HTMLElement[] = []

afterEach(() => {
  anchors.splice(0).forEach((button) => {
    button.remove()
  })
})

/**
 * A three-dot button for the panel to hang from, with a dot inside it.
 *
 * Put in the document rather than left detached: a press is classified by a
 * capturing listener on the document, which an unattached button never reaches.
 */
function anchorAt(box: Partial<DOMRect> = BUTTON): HTMLButtonElement {
  const button = document.createElement('button')

  button.append(document.createElement('span'))
  button.getBoundingClientRect = () => rectOf(box)
  document.body.append(button)
  anchors.push(button)

  return button
}

/** Builds a board row; only the fields the panel reads are varied. */
function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    completed: false,
    dueDate: null,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

/** Mounts the panel, which is to say opens it: it is up from the first paint. */
function mountMenu(anchor: HTMLElement = anchorAt(), subject: TaskSummary = task()) {
  return mount(RowMenu, { props: { task: subject, anchor }, attachTo: document.body })
}

type Menu = ReturnType<typeof mountMenu>

/**
 * The panel itself.
 *
 * Asked for by its `popover` attribute rather than taken from `menu.element`:
 * the component is written with a comment above its root, which the test
 * utilities read as more than one root node — `element` is then the container
 * the wrapper was mounted into, not the panel.
 */
function panelOf(menu: Menu): HTMLElement {
  return menu.get<HTMLElement>('[popover]').element
}

/** A press, seen by the capturing listener on the document. */
function press(target: Element): void {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

/** The browser taking the panel away: a press outside it, or Esc. */
function lightDismiss(panel: HTMLElement): void {
  showing.delete(panel)
  panel.dispatchEvent(toggleEvent('closed'))
}

describe('RowMenu', () => {
  describe('紙上的內容', () => {
    it('prints the number of the docket it belongs to', () => {
      // The panel draws in the top layer, detached from its card; the number is
      // what ties the two back together before anyone presses 刪除.
      const menu = mountMenu()

      expect(menu.get('[data-number]').text()).toBe('bug-0012')
    })

    it('offers editing and deleting, in that order', () => {
      const menu = mountMenu()

      expect(menu.get('[data-edit]').text()).toContain('編輯')
      expect(menu.get('[data-delete]').text()).toContain('刪除')
    })

    it('keeps both glyphs out of the accessibility tree', () => {
      // ✎ and × are drawn beside words that already say what the entries do.
      const menu = mountMenu()

      expect(menu.get('[data-edit] span').attributes('aria-hidden')).toBe('true')
      expect(menu.get('[data-delete] span').attributes('aria-hidden')).toBe('true')
    })
  })

  describe('回答', () => {
    it('passes 編輯 up rather than opening anything itself', async () => {
      const menu = mountMenu()

      await menu.get('[data-edit]').trigger('click')

      expect(menu.emitted('edit')).toHaveLength(1)
      expect(menu.emitted('delete')).toBeUndefined()
    })

    it('passes 刪除 up the same way', async () => {
      const menu = mountMenu()

      await menu.get('[data-delete]').trigger('click')

      expect(menu.emitted('delete')).toHaveLength(1)
      expect(menu.emitted('edit')).toBeUndefined()
    })

    it('takes itself away as it answers, and says so once', async () => {
      // Unlike the confirmation next door, nothing here can fail: 編輯 opens a
      // sheet and 刪除 asks a question, and neither goes to the server. So the
      // panel does not wait to be dismissed — but it may only report going once,
      // however many ways the hiding comes back to it.
      const menu = mountMenu()

      await menu.get('[data-edit]').trigger('click')

      expect(showing.has(panelOf(menu))).toBe(false)
      expect(menu.emitted('close')).toEqual([[false]])
    })
  })

  describe('開關', () => {
    it('is up from the moment it exists', () => {
      // There is no `open()` to call: the card renders the panel when the menu
      // should be up, so being rendered is what open means.
      const menu = mountMenu()

      expect(showing.has(panelOf(menu))).toBe(true)
    })

    it('reports a dismissal it did not ask for', () => {
      // A press outside, or Esc. Both are the browser's, and both have to reach
      // the card — it is the card that holds whether the menu is up.
      const menu = mountMenu()

      lightDismiss(panelOf(menu))

      expect(menu.emitted('close')).toEqual([[false]])
    })

    it('goes on a press on the three-dot button, and says that is what it was', () => {
      // Taken away on the press rather than on the click, and before the
      // browser's own light dismiss would do it: the card has to know which
      // kind of dismissal this was before the click the same press produces,
      // or the button reopens what it has just closed.
      const button = anchorAt()
      const menu = mountMenu(button)

      press(button)

      expect(showing.has(panelOf(menu))).toBe(false)
      expect(menu.emitted('close')).toEqual([[true]])
    })

    it("counts a press on one of the button's own dots", () => {
      // The dots are what a finger actually lands on; the button only contains
      // them.
      const button = anchorAt()
      const menu = mountMenu(button)
      const dot = button.firstElementChild

      press(dot ?? button)

      expect(menu.emitted('close')).toEqual([[true]])
    })

    it('reports one dismissal once, however many ways it comes back', () => {
      // Hiding a popover is itself reported, as a `toggle` event, so the news
      // of a panel taken away here arrives a second time from the browser.
      const button = anchorAt()
      const menu = mountMenu(button)

      press(button)
      lightDismiss(panelOf(menu))

      expect(menu.emitted('close')).toHaveLength(1)
    })

    it('does not mistake a press inside itself for one on the button', () => {
      const menu = mountMenu()

      press(panelOf(menu))
      lightDismiss(panelOf(menu))

      expect(menu.emitted('close')).toEqual([[false]])
    })
  })

  describe('跟著版面走', () => {
    it('goes once the page has scrolled out from under it', () => {
      // The panel is fixed to the window and the card it points at is not.
      const menu = mountMenu()

      Object.defineProperty(window, 'scrollY', { value: 40, configurable: true })
      window.dispatchEvent(new Event('scroll'))

      expect(showing.has(panelOf(menu))).toBe(false)
      expect(menu.emitted('close')).toEqual([[false]])
    })

    it('stays put for a scroll event that moved nothing', () => {
      // A scroll already queued when the panel opens would otherwise close it
      // in the same breath as opening it.
      const menu = mountMenu()

      Object.defineProperty(window, 'scrollY', { value: 1, configurable: true })
      window.dispatchEvent(new Event('scroll'))

      expect(showing.has(panelOf(menu))).toBe(true)
      expect(menu.emitted('close')).toBeUndefined()
    })

    it('goes when the window is resized', () => {
      const menu = mountMenu()

      window.dispatchEvent(new Event('resize'))

      expect(menu.emitted('close')).toEqual([[false]])
    })

    it('stops watching the document once it is gone', () => {
      // The panel is mounted and unmounted on every press of a three-dot
      // button, so a listener left behind is one per press for the whole
      // session.
      const added = vi.spyOn(document, 'addEventListener')
      const menu = mountMenu()
      const handler = added.mock.calls.find(([type]) => type === 'pointerdown')?.[1]
      const removed = vi.spyOn(document, 'removeEventListener')

      menu.unmount()

      expect(handler).toBeDefined()
      expect(removed).toHaveBeenCalledWith('pointerdown', handler, true)
    })
  })

  describe('位置', () => {
    it('hangs under the button, right edges aligned', () => {
      // 126 + 4 down, and 400 - 148 across: the panel hangs back into the card
      // rather than off the side of it.
      const menu = mountMenu(anchorAt())

      expect(panelOf(menu).style.top).toBe('130px')
      expect(panelOf(menu).style.left).toBe('252px')
    })

    it('flips above the button when it would fall off the bottom', () => {
      // 674 - 130 - 4. A panel that opens below the fold is one whose 刪除
      // cannot be reached without scrolling, which closes it.
      const menu = mountMenu(anchorAt({ ...BUTTON, top: 674, bottom: 700 }))

      expect(panelOf(menu).style.top).toBe('540px')
    })

    it('keeps clear of the right edge of the window', () => {
      // 1024 - 148 - 8, rather than the 876 the button's own edge asks for.
      const menu = mountMenu(anchorAt({ ...BUTTON, left: 998, right: 1024 }))

      expect(panelOf(menu).style.left).toBe('868px')
    })

    it('keeps clear of the left edge too', () => {
      const menu = mountMenu(anchorAt({ ...BUTTON, left: 74, right: 100 }))

      expect(panelOf(menu).style.left).toBe('8px')
    })
  })

  describe('無障礙', () => {
    it('names itself, since it is read away from the card it belongs to', () => {
      const menu = mountMenu()

      expect(panelOf(menu).getAttribute('aria-label')).toBe('單子操作')
    })

    it('puts the focus on 編輯 through the browser, not by hand', () => {
      // `autofocus` is named inside the browser's own popover-showing steps,
      // which is what leaves it able to hand focus back to the three-dot button
      // afterwards; a `focus()` of our own would take that away.
      const menu = mountMenu()

      expect(menu.get('[data-edit]').attributes('autofocus')).toBeDefined()
      expect(menu.get('[data-delete]').attributes('autofocus')).toBeUndefined()
    })
  })
})
