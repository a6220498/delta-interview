import TaskDialog from '@/components/TaskDialog/index.vue'
import TaskList from '@/components/TaskList/index.vue'
import type { Task } from '@/types/task'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import App from './App.vue'
import MainLayout from './layouts/MainLayout/index.vue'

/**
 * jsdom 30 ships `<dialog>` as an element but almost none of its behaviour, so
 * opening the sheet would throw before a single assertion ran. Stand-ins for
 * the two methods the sheet drives; see `components/TaskDialog/index.spec.ts`,
 * which tests what the sheet does with them.
 */
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.open = true
  }

  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

/** Builds a task fixture; only the fields the board reads are varied. */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    description: null,
    completed: false,
    dueDate: null,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

describe('App', () => {
  it('mounts the masthead into the layout header landmark rather than the content area', () => {
    // The wiring is the thing under test: the layout exposes two insertion
    // points and the masthead has to take the header one, or the page ships
    // its title inside <main> and the landmark it left behind is empty.
    const wrapper = mount(App)

    expect(wrapper.get('header').text()).toContain('任務管理應用程式')
    expect(wrapper.get('main').text()).not.toContain('任務管理應用程式')
  })

  it('hangs both racks in the content area, in-tray before out-tray', () => {
    // The two trays are one component rendered once per row of the rack table,
    // so the table's order is the order a reader meets the shelves in. Asserted
    // against the literal ids rather than against `TASK_RACKS` itself: an
    // expectation read from the same table the loop reads would pass however
    // the table is rewritten.
    const wrapper = mount(App)

    expect(wrapper.findAllComponents(TaskList).map((tray) => tray.props('rack').id)).toEqual([
      'open',
      'done',
    ])
    // Read off the DOM rather than the components, because where the trays are
    // is the other half of the claim: inside <main>, not in the header.
    expect(wrapper.get('main').findAll('[data-hint]').map((hint) => hint.text())).toEqual([
      'In Tray',
      'Out Tray',
    ])
  })

  it('gives each rack only the tasks that belong on it', () => {
    // Vacuously true while the board has no data source, but it is the rule
    // that has to survive the store landing: no task on both shelves, none
    // missing from both.
    const wrapper = mount(App)
    const [open, done] = wrapper.findAllComponents(TaskList)

    expect(open?.props('tasks').every((task) => !task.completed)).toBe(true)
    expect(done?.props('tasks').every((task) => task.completed)).toBe(true)
  })

  describe('工單彈窗', () => {
    it('keeps the sheet mounted but down until something asks for it', () => {
      // Mounted, because `<dialog>` returns focus to whatever opened it and can
      // only do that while it is still in the document; down, because the board
      // is what the page opens on. One element serves both jobs — it is opened
      // by name, so there is no second sheet to keep in step with this one.
      const wrapper = mount(App)

      expect(wrapper.findAllComponents(TaskDialog)).toHaveLength(1)
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it("opens a blank sheet from the layout's primary action", async () => {
      // The layout reports the press and decides nothing, so this wiring is the
      // only thing that turns 新增工單 into an open sheet.
      const wrapper = mount(App)

      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.get('dialog h2').text()).toBe('新增工單')
      expect(wrapper.get('dialog [data-number]').text()).toBe('NEW')
    })

    it('opens an edit sheet on the task whose docket was asked about', async () => {
      // The card names the task with the event; the board is what turns that
      // into a sheet carrying the values to correct. Asserted through the sheet's
      // own fields rather than through a prop, because there is no longer a prop
      // to assert on — the task is handed over in the call that opens it.
      const wrapper = mount(App)

      wrapper.findComponent(TaskList).vm.$emit('menu', task())
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.get('dialog h2').text()).toBe('編輯工單')
      expect(wrapper.get('dialog [data-number]').text()).toBe('bug-0012')
      expect(wrapper.get<HTMLInputElement>('[data-field="title"] input').element.value).toBe(
        '補上 CORS 設定',
      )
    })

    it('opens the same sheet blank again after an edit', async () => {
      // The board holds one sheet and moves it between jobs, so 新增工單 pressed
      // after an edit has to arrive at a blank form rather than at the last task
      // opened.
      const wrapper = mount(App)

      wrapper.findComponent(TaskList).vm.$emit('menu', task())
      await nextTick()
      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      expect(wrapper.get('dialog h2').text()).toBe('新增工單')
      expect(wrapper.get<HTMLInputElement>('[data-field="title"] input').element.value).toBe('')
    })

    it('closes the sheet when it is submitted', async () => {
      // Only closes it. Filing the task needs an `id` and a `sequence`, and the
      // contract gives both to the server so that no two clients can issue the
      // same number — so nothing is added to the board here.
      const wrapper = mount(App)

      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()
      wrapper.findComponent(TaskDialog).vm.$emit('submit', {
        title: '補上 CORS 設定',
        description: null,
        category: 1,
        dueDate: null,
      })
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.findComponent(TaskList).props('tasks')).toEqual([])
    })
  })
})
