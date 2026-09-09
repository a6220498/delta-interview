import type { Task } from '@/types/task'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import DeleteDialog from './index.vue'

/**
 * jsdom 30 ships `<dialog>` with the reflected `open` and nothing else. These stand-ins
 * do the two things the component depends on: `open` flipping, and `close` firing.
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

/** Mounts the confirmation, left down: asking is a call, so it is never up on arrival. */
function mountSheet() {
  return mount(DeleteDialog, { attachTo: document.body })
}

/**
 * Mounts the confirmation and asks about `subject`. Awaited, since the number and
 * title are written as the sheet opens and the DOM is a tick behind.
 */
async function mountAsking(subject: Task = task()) {
  const wrapper = mountSheet()

  wrapper.vm.open(subject)
  await nextTick()

  return wrapper
}

describe('DeleteDialog', () => {
  describe('紙上的內容', () => {
    it('names the job it is asking about', async () => {
      const wrapper = await mountAsking()

      expect(wrapper.get('h2').text()).toBe('刪除工單')
    })

    it("copies out the docket's number and its title, not 這個項目", async () => {
      // The question has to name its subject: 刪除 sits next to 編輯 in the row
      // menu, and someone who pressed the wrong one finds out here or not at all.
      const wrapper = await mountAsking()

      expect(wrapper.get('[data-number]').text()).toBe('bug-0012')
      expect(wrapper.get('[data-quote]').text()).toBe('補上 CORS 設定')
    })

    it('says what will happen and that it cannot be taken back', async () => {
      const wrapper = await mountAsking()

      expect(wrapper.get('p[id]').text()).toBe('單子會從架上撤掉，這個動作無法復原。')
    })

    it('re-copies both when asked about a different docket', async () => {
      // The paper is filled in as the sheet opens. Reopening on another task
      // without re-reading it would show the previous title under the new number.
      const wrapper = await mountAsking()

      wrapper.vm.close()
      wrapper.vm.open(task({ category: 0, sequence: 7, title: '換掉錯字' }))
      await nextTick()

      expect(wrapper.get('[data-number]').text()).toBe('feat-0007')
      expect(wrapper.get('[data-quote]').text()).toBe('換掉錯字')
    })
  })

  describe('回答', () => {
    it('hands up the docket it was asking about, rather than a bare yes', async () => {
      // The owner is not asked to remember which task is on the desk: a second
      // copy of that fact is one that can disagree with the number on the paper.
      const subject = task()
      const wrapper = await mountAsking(subject)

      await wrapper.get('[data-confirm]').trigger('click')

      expect(wrapper.emitted('confirm')).toEqual([[subject]])
    })

    it('stays up on 確定, so a failed delete still has its question on screen', async () => {
      // Closing is the owner's to do, once the delete has landed.
      const wrapper = await mountAsking()

      await wrapper.get('[data-confirm]').trigger('click')

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('answers nothing on 取消, and takes itself away', async () => {
      const wrapper = await mountAsking()

      await wrapper.get('[data-cancel]').trigger('click')

      expect(wrapper.emitted('confirm')).toBeUndefined()
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('treats a dismissal as no answer at all, Esc included', async () => {
      // Esc is equivalent to 取消 on purpose: an unanswered destructive question
      // defaults to not doing it.
      const wrapper = await mountAsking()

      wrapper.get<HTMLDialogElement>('dialog').element.close()
      await nextTick()

      expect(wrapper.emitted('confirm')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('開關', () => {
    it('stays down until something asks it a question', () => {
      const wrapper = mountSheet()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('opens as a modal, not as an inline block', async () => {
      // showModal is what brings the focus trap, the Esc key and the backdrop;
      // show() would render the same markup with none of them.
      const wrapper = mountSheet()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open(task())
      await nextTick()

      expect(showModal).toHaveBeenCalledOnce()
    })

    it('moves an open question onto another docket without opening it twice', async () => {
      // showModal() on a dialog that is already open throws.
      const wrapper = await mountAsking()
      const showModal = vi.spyOn(wrapper.get<HTMLDialogElement>('dialog').element, 'showModal')

      wrapper.vm.open(task({ sequence: 7, title: '換掉錯字' }))
      await nextTick()

      expect(showModal).not.toHaveBeenCalled()
      expect(wrapper.get('[data-quote]').text()).toBe('換掉錯字')
    })

    it('takes itself away when asked, and says that it went', async () => {
      const wrapper = await mountAsking()

      wrapper.vm.close()
      await nextTick()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('ignores a close on a sheet that is already down', async () => {
      // The owner closes after a delete without first checking what the person
      // did while it was in flight, so a second close has to be nothing.
      const wrapper = await mountAsking()

      wrapper.vm.close()
      wrapper.vm.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('無障礙', () => {
    it('declares itself an alert dialog rather than a plain one', async () => {
      const wrapper = await mountAsking()

      expect(wrapper.get('dialog').attributes('role')).toBe('alertdialog')
    })

    it('names itself by its heading and describes itself by its warning', async () => {
      // The description is what an alertdialog reads out on opening, which is
      // when the consequence is worth hearing — not after the button is pressed.
      const wrapper = await mountAsking()
      const dialog = wrapper.get('dialog')

      expect(dialog.attributes('aria-labelledby')).toBe(wrapper.get('h2').attributes('id'))
      expect(dialog.attributes('aria-describedby')).toBe(wrapper.get('p[id]').attributes('id'))
    })

    it('puts the focus on 取消, never on the red button', async () => {
      // A destructive action may not be what a stray Enter lands on.
      const wrapper = await mountAsking()

      expect(document.activeElement).toBe(wrapper.get('[data-cancel]').element)
    })

    it('gives two confirmations on one page two sets of ids', () => {
      // Hard-coded ids would leave one sheet described by the other's warning. Both
      // mounted in one app: `useId` counts per app, so separate mounts would collide.
      const wrapper = mount(
        defineComponent({
          render: () => [h(DeleteDialog), h(DeleteDialog)],
        }),
      )

      const ids = wrapper.findAll('dialog').map((dialog) => dialog.attributes('aria-describedby'))

      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })
  })
})
