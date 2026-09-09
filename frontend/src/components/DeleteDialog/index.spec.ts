import type { TaskSummary } from '@/types/task'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import DeleteDialog from './index.vue'

const fetchMock = vi.fn<typeof fetch>()

/**
 * jsdom 30 ships `<dialog>` with the reflected `open` and nothing else. These stand-ins
 * do the two things the component depends on: `open` flipping, and `close` firing.
 */
beforeEach(() => {
  // The confirmation deletes on its own, so it needs somewhere to delete from and
  // a server to answer. A fresh pinia per test: Pinia keeps one store per pinia,
  // and a board emptied in one test would still be empty in the next.
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(noContent())

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

/**
 * Builds a task fixture. A `TaskSummary`, not a `Task`: the row the shelf hands up is
 * all this sheet is ever given, and asking for a description would cost a second GET.
 */
function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    completed: false,
    dueDate: '2026-09-30',
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The empty 204 the contract answers a delete with. */
function noContent(): Response {
  return new Response(null, { status: 204 })
}

/** Returns the URL passed to the most recent `fetch` call. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

/** Returns the options passed to the most recent `fetch` call. */
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {}
}

/** Mounts the confirmation, left down: asking is a call, so it is never up on arrival. */
function mountSheet() {
  return mount(DeleteDialog, { attachTo: document.body })
}

/**
 * Mounts the confirmation and asks about `subject`. Awaited, since the number and
 * title are written as the sheet opens and the DOM is a tick behind.
 */
async function mountAsking(subject: TaskSummary = task()) {
  const wrapper = mountSheet()

  wrapper.vm.open(subject)
  await nextTick()

  return wrapper
}

/** Presses 確定 and waits for whatever that put on the wire to come back. */
async function confirm(wrapper: ReturnType<typeof mountSheet>): Promise<void> {
  await wrapper.get('[data-confirm]').trigger('click')
  await flushPromises()
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
    it('deletes the docket it was asking about, and no other', async () => {
      // Nobody else is asked to remember which task is on the desk: a second copy
      // of that fact is one that can disagree with the number on the paper.
      const wrapper = await mountAsking(task({ id: 'the-one-on-the-desk' }))

      await confirm(wrapper)

      expect(lastUrl()).toBe('/api/tasks/the-one-on-the-desk')
      expect(lastInit().method).toBe('DELETE')
    })

    it('deletes the docket it was last asked about, after being moved', async () => {
      // The paper is re-copied when the question moves; the id it deletes has to
      // move with it, or the sheet would withdraw the docket it stopped naming.
      const wrapper = await mountAsking()

      wrapper.vm.open(task({ id: 'the-second-one' }))
      await nextTick()
      await confirm(wrapper)

      expect(lastUrl()).toBe('/api/tasks/the-second-one')
    })

    it('takes itself away once the delete has landed', async () => {
      const wrapper = await mountAsking()

      await confirm(wrapper)

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('stays up until it has, so a refusal has its question still on screen', async () => {
      // Closed on the press, a refusal would arrive with nothing left to report
      // it on, and the docket would read as withdrawn when it is still filed.
      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve
        }),
      )
      const wrapper = await mountAsking()

      await wrapper.get('[data-confirm]').trigger('click')

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.emitted('close')).toBeUndefined()

      settle(noContent())
      await flushPromises()

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('sends one request when 確定 is pressed twice', async () => {
      // The second would answer 404 on a docket that went perfectly well, and
      // print a refusal for a delete that actually happened.
      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve
        }),
      )
      const wrapper = await mountAsking()

      await wrapper.get('[data-confirm]').trigger('click')
      await wrapper.get('[data-confirm]').trigger('click')

      settle(noContent())
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('deletes nothing on 取消, and takes itself away', async () => {
      const wrapper = await mountAsking()

      await wrapper.get('[data-cancel]').trigger('click')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('treats a dismissal as no answer at all, Esc included', async () => {
      // Esc is equivalent to 取消 on purpose: an unanswered destructive question
      // defaults to not doing it.
      const wrapper = await mountAsking()

      wrapper.get<HTMLDialogElement>('dialog').element.close()
      await nextTick()

      expect(fetchMock).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })
  })

  describe('刪除失敗', () => {
    /** The 404 the contract answers with when the docket is already gone. */
    function refused(): Response {
      return jsonResponse(404, {
        status: 404,
        title: 'Not Found',
        detail: '這張單子已經不在了。',
      })
    }

    it('prints nothing while nothing has failed', async () => {
      const wrapper = await mountAsking()

      expect(wrapper.find('[data-delete-error]').exists()).toBe(false)
    })

    it("says the docket is still there, in the server's own words", async () => {
      // 沒撤掉 alone gives nothing to act on: whether it was already deleted or
      // the server refused is the difference between reloading and retrying.
      fetchMock.mockResolvedValue(refused())
      const wrapper = await mountAsking()

      await confirm(wrapper)

      const notice = wrapper.get('[data-delete-error]')

      expect(notice.attributes('role')).toBe('alert')
      expect(notice.text()).toContain('這張單子沒撤掉')
      expect(notice.text()).toContain('這張單子已經不在了。')
    })

    it('says so even when the request never reached a server', async () => {
      // `fetch` rejects with a TypeError when the backend is not running, which
      // is the likeliest failure in development and is not an `ApiError`.
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const wrapper = await mountAsking()

      await confirm(wrapper)

      expect(wrapper.get('[data-delete-error]').text()).toContain('Failed to fetch')
    })

    it('keeps the question, and the docket it names, on screen', async () => {
      fetchMock.mockResolvedValue(refused())
      const wrapper = await mountAsking()

      await confirm(wrapper)

      expect(wrapper.get('dialog').attributes('open')).toBeDefined()
      expect(wrapper.get('[data-quote]').text()).toBe('補上 CORS 設定')
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('lets 確定 be pressed again once a refusal has come back', async () => {
      // The guard is about one request being in flight, not about one question:
      // a delete refused by a hiccup has to be retryable without reopening.
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const wrapper = await mountAsking()
      await confirm(wrapper)

      fetchMock.mockResolvedValue(noContent())
      await confirm(wrapper)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
    })

    it('does not carry a refusal onto the next docket', async () => {
      // One sheet answers every 刪除 on the board; a notice left on it would
      // blame the next docket for a refusal that belongs to the previous one.
      fetchMock.mockResolvedValue(refused())
      const wrapper = await mountAsking()
      await confirm(wrapper)

      wrapper.vm.close()
      wrapper.vm.open(task({ id: 'another', title: '換掉錯字' }))
      await nextTick()

      expect(wrapper.find('[data-delete-error]').exists()).toBe(false)
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
