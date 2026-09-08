import type { Task } from '@/types/task'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import TaskDialog from './index.vue'

/**
 * jsdom 30 ships `<dialog>` as an element but almost none of its behaviour:
 * the prototype carries the reflected `open` property and nothing else, so
 * `showModal` is not a function at all and mounting the component would throw
 * before a single assertion ran.
 *
 * These stand-ins do the two things the component actually depends on — `open`
 * flipping, and `close` firing the event the browser fires when Esc dismisses a
 * dialog. Everything the real element does beyond that (the top layer, the focus
 * trap, the backdrop) is the browser's, is untestable here, and is exactly why
 * the component uses a native dialog instead of building its own.
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

enableAutoUnmount(afterEach)

/** Builds a task fixture; only the fields this component reads are varied. */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    description: '前端在 5173，後端在 8080。',
    completed: false,
    dueDate: '2026-09-30',
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

/** Mounts an open blank sheet, attached so focus assertions mean something. */
function mountCreate() {
  return mount(TaskDialog, {
    props: { open: true, mode: 'create' as const },
    attachTo: document.body,
  })
}

/** Mounts an open sheet reopened on `source`. */
function mountEdit(source: Task = task()) {
  return mount(TaskDialog, {
    props: { open: true, mode: 'edit' as const, task: source },
    attachTo: document.body,
  })
}

/** The value currently in one of the four fields. */
function valueOf(wrapper: ReturnType<typeof mountCreate>, field: string): string {
  return wrapper.get<HTMLInputElement>(`[data-field="${field}"] input, [data-field="${field}"] select, [data-field="${field}"] textarea`).element.value
}

describe('TaskDialog', () => {
  describe('新增模式', () => {
    it('names itself as the blank sheet it is', () => {
      const wrapper = mountCreate()

      expect(wrapper.get('h2').text()).toBe('新增工單')
    })

    it('says NEW where the number goes, rather than leaving the slot empty', () => {
      // A blank slot beside the heading reads as a number that failed to load;
      // a new task genuinely has no number until the server issues one.
      const wrapper = mountCreate()

      expect(wrapper.get('[data-number]').text()).toBe('NEW')
    })

    it('opens on empty fields with the first category selected', () => {
      const wrapper = mountCreate()

      expect(valueOf(wrapper, 'title')).toBe('')
      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
      expect(valueOf(wrapper, 'category')).toBe('1')
    })

    it('mounts without a task and without complaint', () => {
      // The props are a union, so a blank sheet legitimately carries no task.
      // A `task` marked required in the generated runtime props would still
      // render correctly and only warn — which is precisely what would be
      // missed without this.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mountCreate()

      expect(warn).not.toHaveBeenCalled()
    })
  })

  describe('編輯模式', () => {
    it('names itself as the correction it is', () => {
      const wrapper = mountEdit()

      expect(wrapper.get('h2').text()).toBe('編輯工單')
    })

    it("carries the task's number in the corner, so the sheet says which one it is", () => {
      const wrapper = mountEdit()

      expect(wrapper.get('[data-number]').text()).toBe('bug-0012')
    })

    it('brings every stored value back into its own field', () => {
      const wrapper = mountEdit()

      expect(valueOf(wrapper, 'title')).toBe('補上 CORS 設定')
      expect(valueOf(wrapper, 'category')).toBe('1')
      expect(valueOf(wrapper, 'description')).toBe('前端在 5173，後端在 8080。')
      expect(valueOf(wrapper, 'due-date')).toBe('2026-09-30')
    })

    it('leaves the optional fields blank when the task has neither', () => {
      // The contract sends `null` for "not set". Assigned straight to an input
      // that renders the four characters `null`, which a person would then have
      // to delete before typing.
      const wrapper = mountEdit(task({ description: null, dueDate: null }))

      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
    })

    it('reseeds when reopened on a different task', async () => {
      // The values are read once, as the sheet opens. Reopening on another task
      // without re-reading them would show the previous task's title under the
      // new task's number.
      const wrapper = mountEdit()

      await wrapper.setProps({ open: false })
      await wrapper.setProps({ open: true, task: task({ title: '換掉錯字', sequence: 7 }) })

      expect(valueOf(wrapper, 'title')).toBe('換掉錯字')
    })

    it('keeps what is typed when the task it was opened on is replaced', async () => {
      // The caller updates the task it holds as soon as a save lands; re-seeding
      // on that would wipe out everything typed since the sheet opened.
      const wrapper = mountEdit()

      await wrapper.get('[data-field="title"] input').setValue('打到一半')
      await wrapper.setProps({ task: task({ title: '伺服器回來的標題' }) })

      expect(valueOf(wrapper, 'title')).toBe('打到一半')
    })
  })

  describe('提示列', () => {
    it('keeps every row empty but standing, apart from the one with a message', async () => {
      // The rows exist to hold their height, so a message appearing does not
      // push the form down under the reader. Changing category writes nothing:
      // the number a task would be re-issued is the server's to assign, so
      // there is nothing truthful to say about it here.
      const wrapper = mountEdit()

      await wrapper.get('select').setValue(0)

      expect(wrapper.findAll('span[aria-live]').map((row) => row.text())).toEqual(['', '', '', ''])
    })
  })

  describe('送出', () => {
    it('hands up exactly what the four fields hold', async () => {
      const wrapper = mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('  補上 CORS 設定  ')
      await wrapper.get('select').setValue(0)
      await wrapper.get('textarea').setValue('  前端在 5173  ')
      await wrapper.get('[data-field="due-date"] input').setValue('2026-09-30')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toEqual([
        [
          {
            title: '補上 CORS 設定',
            description: '前端在 5173',
            category: 0,
            dueDate: '2026-09-30',
          },
        ],
      ])
    })

    it('sends the empty optional fields as null rather than as empty strings', async () => {
      // Both requests replace the whole task, so `''` would file a task whose
      // deadline is the empty string instead of one with no deadline.
      const wrapper = mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('沒有說明也沒有期限')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
        description: null,
        dueDate: null,
      })
    })

    it('refuses a blank title and says so in the row kept for it', async () => {
      const wrapper = mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('   ')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.get('[data-field="title"] span[aria-live]').text()).toBe('標題不能空白。')
    })

    it('reddens the line as well as the message, focus included', async () => {
      // A red message beside a black line reads as a note about the form; the
      // whole field has to say which one is wrong — the line and the weight
      // under it both. Failing validation also puts the caret in this field, so
      // a standing focus colour would take the red away at the one moment it is
      // needed.
      const wrapper = mountCreate()

      await wrapper.get('form').trigger('submit')

      const classes = wrapper.get('[data-field="title"] input').classes()

      expect(classes).toContain('border-b-alert')
      expect(classes).toContain('focus:border-b-alert')
      expect(classes).toContain('focus:shadow-[0_1.5px_0_var(--color-alert)]')
      expect(classes).not.toContain('focus:border-b-stamp')
      expect(classes).not.toContain('focus:shadow-[0_1.5px_0_var(--color-stamp)]')
    })

    it('takes the message away as soon as the person starts fixing it', async () => {
      const wrapper = mountCreate()

      await wrapper.get('form').trigger('submit')
      await wrapper.get('[data-field="title"] input').setValue('補')

      expect(wrapper.get('[data-field="title"] span[aria-live]').text()).toBe('')
    })

    it('stays open, so a rejected save does not take the typing with it', async () => {
      // Closing is the caller's to do once the write has landed.
      const wrapper = mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('close')).toBeUndefined()
      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    })
  })

  describe('開關', () => {
    it('opens as a modal, not as an inline block', async () => {
      // showModal is what brings the focus trap, the Esc key and the backdrop;
      // show() would render the same markup with none of them.
      const wrapper = mount(TaskDialog, { props: { open: false, mode: 'create' as const } })
      const dialog = wrapper.get<HTMLDialogElement>('dialog').element
      const showModal = vi.spyOn(dialog, 'showModal')

      await wrapper.setProps({ open: true })

      expect(showModal).toHaveBeenCalledOnce()
    })

    it('reports 取消 rather than closing itself', async () => {
      const wrapper = mountCreate()

      await wrapper.get('button[type="button"]').trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    })

    it('reports the dismissals the browser carries out, such as Esc', async () => {
      const wrapper = mountCreate()

      wrapper.get<HTMLDialogElement>('dialog').element.close()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('does not report a close the caller asked for', async () => {
      // The caller already knows; echoing it back is a close it never asked for.
      const wrapper = mountCreate()

      await wrapper.setProps({ open: false })

      expect(wrapper.emitted('close')).toBeUndefined()
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })
  })

  describe('無障礙', () => {
    it('points every label at its own field', async () => {
      const wrapper = mountEdit()
      const labels = wrapper.findAll('label')
      const ids = wrapper
        .findAll('input, select, textarea')
        .map((field) => field.attributes('id'))

      expect(labels).toHaveLength(4)
      expect(labels.map((label) => label.attributes('for'))).toEqual(ids)
    })

    it('names the sheet by its own heading', async () => {
      const wrapper = mountEdit()

      expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe(
        wrapper.get('h2').attributes('id'),
      )
    })

    it('gives two sheets on one page two sets of ids', () => {
      // Hard-coded ids would leave one label pointing at the other sheet's
      // field, which is worse than having no label at all. Both sheets are
      // mounted inside one app on purpose: `useId` counts per app, so two
      // separate `mount()` calls would both start at the same number and the
      // test would pass on components that share every id.
      const wrapper = mount(
        defineComponent({
          render: () => [
            h(TaskDialog, { open: false, mode: 'create' as const }),
            h(TaskDialog, { open: false, mode: 'create' as const }),
          ],
        }),
      )

      const ids = wrapper.findAll('[data-field="title"] input').map((field) => field.attributes('id'))

      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })

    it('keeps the required star out of the accessibility tree', () => {
      // `required` on the input is what carries the meaning; the star is a mark
      // for people who can see the form, and announcing it says "asterisk".
      const wrapper = mountCreate()

      expect(wrapper.get('[data-field="title"] input').attributes('required')).toBeDefined()
      expect(wrapper.get('[data-field="title"] label span').attributes('aria-hidden')).toBe('true')
    })

    it('binds each message row back to the field it talks about', () => {
      const wrapper = mountCreate()
      const input = wrapper.get('[data-field="title"] input')
      const message = wrapper.get('[data-field="title"] span[aria-live]')

      expect(input.attributes('aria-describedby')).toBe(message.attributes('id'))
      expect(message.attributes('aria-live')).toBe('polite')
    })
  })
})
