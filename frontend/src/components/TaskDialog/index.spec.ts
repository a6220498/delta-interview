import type { Task } from '@/types/task'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import TaskDialog from './index.vue'

/**
 * jsdom 30 ships `<dialog>` as an element but almost none of its behaviour:
 * the prototype carries the reflected `open` property and nothing else, so
 * `showModal` is not a function at all and opening the sheet would throw before
 * a single assertion ran.
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

/** Mounts a sheet, left down: opening it is a call, so it is never up on arrival. */
function mountSheet() {
  return mount(TaskDialog, { attachTo: document.body })
}

/**
 * Mounts a sheet and opens it blank.
 *
 * Awaited, unlike the props this component used to take: the values are written
 * to the fields as the sheet opens, so the DOM is one tick behind the call.
 */
async function mountCreate() {
  const wrapper = mountSheet()

  wrapper.vm.open('create')
  await nextTick()

  return wrapper
}

/** Mounts a sheet and opens it on `source`. */
async function mountEdit(source: Task = task()) {
  const wrapper = mountSheet()

  wrapper.vm.open('edit', source)
  await nextTick()

  return wrapper
}

/** The value currently in one of the four fields. */
function valueOf(wrapper: ReturnType<typeof mountSheet>, field: string): string {
  return wrapper.get<HTMLInputElement>(`[data-field="${field}"] input, [data-field="${field}"] select, [data-field="${field}"] textarea`).element.value
}

describe('TaskDialog', () => {
  describe('新增模式', () => {
    it('names itself as the blank sheet it is', async () => {
      const wrapper = await mountCreate()

      expect(wrapper.get('h2').text()).toBe('新增工單')
    })

    it('says NEW where the number goes, rather than leaving the slot empty', async () => {
      // A blank slot beside the heading reads as a number that failed to load;
      // a new task genuinely has no number until the server issues one.
      const wrapper = await mountCreate()

      expect(wrapper.get('[data-number]').text()).toBe('NEW')
    })

    it('opens on empty fields with the first category selected', async () => {
      const wrapper = await mountCreate()

      expect(valueOf(wrapper, 'title')).toBe('')
      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
      expect(valueOf(wrapper, 'category')).toBe('1')
    })

    it('leaves nothing of the task it was last opened on', async () => {
      // One sheet serves both jobs now, so a blank one opened after an edit is
      // the same element with the same fields — emptied, or the new task starts
      // life carrying the last one's title.
      const wrapper = await mountEdit()

      wrapper.vm.open('create')
      await nextTick()

      expect(wrapper.get('h2').text()).toBe('新增工單')
      expect(wrapper.get('[data-number]').text()).toBe('NEW')
      expect(valueOf(wrapper, 'title')).toBe('')
      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
    })
  })

  describe('編輯模式', () => {
    it('names itself as the correction it is', async () => {
      const wrapper = await mountEdit()

      expect(wrapper.get('h2').text()).toBe('編輯工單')
    })

    it("carries the task's number in the corner, so the sheet says which one it is", async () => {
      const wrapper = await mountEdit()

      expect(wrapper.get('[data-number]').text()).toBe('bug-0012')
    })

    it('brings every stored value back into its own field', async () => {
      const wrapper = await mountEdit()

      expect(valueOf(wrapper, 'title')).toBe('補上 CORS 設定')
      expect(valueOf(wrapper, 'category')).toBe('1')
      expect(valueOf(wrapper, 'description')).toBe('前端在 5173，後端在 8080。')
      expect(valueOf(wrapper, 'due-date')).toBe('2026-09-30')
    })

    it('leaves the optional fields blank when the task has neither', async () => {
      // The contract sends `null` for "not set". Assigned straight to an input
      // that renders the four characters `null`, which a person would then have
      // to delete before typing.
      const wrapper = await mountEdit(task({ description: null, dueDate: null }))

      expect(valueOf(wrapper, 'description')).toBe('')
      expect(valueOf(wrapper, 'due-date')).toBe('')
    })

    it('reseeds when reopened on a different task', async () => {
      // The values are read once, as the sheet opens. Reopening on another task
      // without re-reading them would show the previous task's title under the
      // new task's number.
      const wrapper = await mountEdit()

      wrapper.vm.close()
      wrapper.vm.open('edit', task({ title: '換掉錯字', sequence: 7 }))
      await nextTick()

      expect(valueOf(wrapper, 'title')).toBe('換掉錯字')
      expect(wrapper.get('[data-number]').text()).toBe('bug-0007')
    })

    it('starts the caret in 標題 with the old title selected', async () => {
      // The spec's own behaviour: the sheet opens ready to have its title typed
      // over. Selecting is why the focus waits a tick — run before the fields
      // are written it would select whatever the box held a render ago.
      const wrapper = await mountEdit()
      const input = wrapper.get<HTMLInputElement>('[data-field="title"] input').element

      expect(document.activeElement).toBe(input)
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(task().title.length)
    })
  })

  describe('提示列', () => {
    it('keeps every row empty but standing, apart from the one with a message', async () => {
      // The rows exist to hold their height, so a message appearing does not
      // push the form down under the reader. Changing category writes nothing:
      // the number a task would be re-issued is the server's to assign, so
      // there is nothing truthful to say about it here.
      const wrapper = await mountEdit()

      await wrapper.get('select').setValue(0)

      expect(wrapper.findAll('span[aria-live]').map((row) => row.text())).toEqual(['', '', '', ''])
    })
  })

  describe('送出', () => {
    it('hands up exactly what the four fields hold', async () => {
      const wrapper = await mountCreate()

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
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('沒有說明也沒有期限')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
        description: null,
        dueDate: null,
      })
    })

    it('refuses a blank title and says so in the row kept for it', async () => {
      const wrapper = await mountCreate()

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
      const wrapper = await mountCreate()

      await wrapper.get('form').trigger('submit')

      const classes = wrapper.get('[data-field="title"] input').classes()

      expect(classes).toContain('border-b-alert')
      expect(classes).toContain('focus:border-b-alert')
      expect(classes).toContain('focus:shadow-[0_1.5px_0_var(--color-alert)]')
      expect(classes).not.toContain('focus:border-b-stamp')
      expect(classes).not.toContain('focus:shadow-[0_1.5px_0_var(--color-stamp)]')
    })

    it('takes the message away as soon as the person starts fixing it', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('form').trigger('submit')
      await wrapper.get('[data-field="title"] input').setValue('補')

      expect(wrapper.get('[data-field="title"] span[aria-live]').text()).toBe('')
    })

    it('stays up, so a rejected save does not take the typing with it', async () => {
      // Closing is the owner's to do, once the write has landed.
      const wrapper = await mountCreate()

      await wrapper.get('[data-field="title"] input').setValue('補上 CORS 設定')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('close')).toBeUndefined()
      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    })
  })

  describe('開關', () => {
    it('stays down until it is asked for', () => {
      // Nothing but `open()` puts the sheet up, so a page can mount it once and
      // leave it there — which is what lets the browser hand focus back to
      // whichever control opened it.
      const wrapper = mountSheet()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('opens as a modal, not as an inline block', async () => {
      // showModal is what brings the focus trap, the Esc key and the backdrop;
      // show() would render the same markup with none of them.
      const wrapper = mountSheet()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open('create')
      await nextTick()

      expect(showModal).toHaveBeenCalledOnce()
    })

    it('moves an open sheet onto another task without opening it twice', async () => {
      // showModal() on a dialog that is already open throws, and the owner is
      // entitled to call open() again — the row menu of a second card while the
      // first is still on the desk.
      const wrapper = await mountEdit()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open('edit', task({ title: '換掉錯字', sequence: 7 }))
      await nextTick()

      expect(showModal).not.toHaveBeenCalled()
      expect(valueOf(wrapper, 'title')).toBe('換掉錯字')
    })

    it('takes itself away when asked, and says that it went', async () => {
      const wrapper = await mountCreate()

      wrapper.vm.close()
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('closes on 取消 rather than asking to be closed', async () => {
      const wrapper = await mountCreate()

      await wrapper.get('button[type="button"]').trigger('click')

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('reports the dismissals the browser carries out, such as Esc', async () => {
      const wrapper = await mountCreate()

      wrapper.get<HTMLDialogElement>('dialog').element.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('ignores a close on a sheet that is already down', async () => {
      // The owner closes the sheet after a save without first checking what the
      // person did while it was in flight, so a second close has to be nothing.
      const wrapper = await mountCreate()

      wrapper.vm.close()
      wrapper.vm.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('無障礙', () => {
    it('points every label at its own field', async () => {
      const wrapper = await mountEdit()
      const labels = wrapper.findAll('label')
      const ids = wrapper
        .findAll('input, select, textarea')
        .map((field) => field.attributes('id'))

      expect(labels).toHaveLength(4)
      expect(labels.map((label) => label.attributes('for'))).toEqual(ids)
    })

    it('names the sheet by its own heading', async () => {
      const wrapper = await mountEdit()

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
          render: () => [h(TaskDialog), h(TaskDialog)],
        }),
      )

      const ids = wrapper.findAll('[data-field="title"] input').map((field) => field.attributes('id'))

      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })

    it('keeps the required star out of the accessibility tree', async () => {
      // `required` on the input is what carries the meaning; the star is a mark
      // for people who can see the form, and announcing it says "asterisk".
      const wrapper = await mountCreate()

      expect(wrapper.get('[data-field="title"] input').attributes('required')).toBeDefined()
      expect(wrapper.get('[data-field="title"] label span').attributes('aria-hidden')).toBe('true')
    })

    it('binds each message row back to the field it talks about', async () => {
      const wrapper = await mountCreate()
      const input = wrapper.get('[data-field="title"] input')
      const message = wrapper.get('[data-field="title"] span[aria-live]')

      expect(input.attributes('aria-describedby')).toBe(message.attributes('id'))
      expect(message.attributes('aria-live')).toBe('polite')
    })
  })
})
