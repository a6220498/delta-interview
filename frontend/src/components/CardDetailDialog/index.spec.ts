import type { Task, TaskSummary } from '@/types/task'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useTasksStore } from '@/stores/tasks'

import CardDetailDialog from './index.vue'

const fetchMock = vi.fn<typeof fetch>()

/**
 * jsdom 30 ships `<dialog>` with the reflected `open` and nothing else. These stand-ins
 * do the two things the component depends on: `open` flipping, and `close` firing.
 */
beforeEach(() => {
  // The sheet fetches its own 說明, so it needs a server to answer. A fresh pinia
  // per test as well: the board's `error` is asserted on, and it outlives a test.
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(200, detail()))

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
 * Builds the row a shelf hands over. The due date is pinned far from any date the
 * suite could run on, since the sheet reads the real clock to decide "overdue".
 */
function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定，讓 5173 打得到 8080',
    completed: false,
    dueDate: '2099-09-07',
    createdAt: '2026-09-05T09:12:44Z',
    updatedAt: '2026-09-06T14:03:00Z',
    ...overrides,
  }
}

const LONG_PAST = '2020-01-04'

/** Builds the whole task `GET /api/tasks/{id}` answers with: the row plus its detail. */
function detail(overrides: Partial<Task> = {}): Task {
  return { ...task(), description: 'Vite dev server 在 5173、後端在 8080。', ...overrides }
}

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Builds the problem body the backend answers with when the copy cannot be drawn. */
function refused(): Response {
  return jsonResponse(500, {
    status: 500,
    title: 'Internal Server Error',
    detail: '第二聯的櫃子卡住了。',
  })
}

/** A promise plus its own settlers, for the tests that need a request left in flight. */
function deferred<T>() {
  let settle!: (value: T) => void

  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, settle }
}

/** The URL the most recent request went to. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

/** Mounts a sheet, left down: reading a docket is a call, so it is never up on arrival. */
function mountSheet() {
  return mount(CardDetailDialog, { attachTo: document.body })
}

/**
 * Mounts a sheet and pulls `subject` off the shelf, without waiting for the 說明 to
 * land. This is the state the spec calls 先畫再補: everything but one block is drawn.
 */
async function mountReading(subject: TaskSummary = task()) {
  const wrapper = mountSheet()

  wrapper.vm.open(subject)
  await nextTick()

  return wrapper
}

/** Mounts a sheet, opens it, and waits for the 說明 request to come back. */
async function mountRead(subject: TaskSummary = task()) {
  const wrapper = await mountReading(subject)

  await flushPromises()

  return wrapper
}

/** The text of one of the three meta cells. */
function factOf(wrapper: ReturnType<typeof mountSheet>, name: string): string {
  return wrapper.get(`[data-fact="${name}"]`).text()
}

describe('CardDetailDialog', () => {
  describe('先畫再補', () => {
    it('names itself as the copy it is, not as another 編輯工單', async () => {
      const wrapper = await mountReading()

      expect(wrapper.get('h2').text()).toBe('工單明細')
    })

    it('draws every field the shelf already holds before the 說明 is asked for', async () => {
      // The row carries all of `Task` but `description`, so making the whole window
      // wait on one request would blank six fields that are already in hand.
      const wrapper = await mountReading()

      expect(wrapper.get('[data-number]').text()).toBe('bug-0012')
      expect(wrapper.get('[data-title]').text()).toBe('補上 CORS 設定，讓 5173 打得到 8080')
      expect(factOf(wrapper, 'state')).toContain('未完成')
      expect(factOf(wrapper, 'due-date')).toContain('2099-09-07')
      expect(factOf(wrapper, 'category')).toContain('bug — 修復')
    })

    it('prints the due date with its year, unlike the card it was opened from', async () => {
      // A card drops the year because the year of near-term work is noise. A sheet
      // taken out to be read is not near-term work, so it prints the contract's date.
      const wrapper = await mountReading(task({ dueDate: '2099-01-05' }))

      expect(factOf(wrapper, 'due-date')).toContain('2099-01-05')
      expect(factOf(wrapper, 'due-date')).not.toContain('01/05')
    })

    it('says there is no deadline rather than leaving the cell blank', async () => {
      const wrapper = await mountReading(task({ dueDate: null }))

      expect(factOf(wrapper, 'due-date')).toContain('無期限')
    })

    it('marks a passed deadline, since a date alone does not say it has gone by', async () => {
      const wrapper = await mountReading(task({ dueDate: LONG_PAST }))

      expect(factOf(wrapper, 'due-date')).toContain('逾期')
    })

    it('keeps 逾期 off a docket that was finished late', async () => {
      // Overdue is a debt still owed. A stamped docket owes nothing, however late.
      const wrapper = await mountReading(task({ dueDate: LONG_PAST, completed: true }))

      expect(factOf(wrapper, 'due-date')).not.toContain('逾期')
    })

    it('prints when the docket was opened and when it was last touched, to the minute', async () => {
      // The only screen that shows either. Seconds and the zone marker are dropped:
      // neither tells a reader anything about a docket they cannot already see.
      const wrapper = await mountReading()

      expect(wrapper.get('[data-created]').text()).toBe('2026-09-05 09:12')
      expect(wrapper.get('[data-updated]').text()).toBe('2026-09-06 14:03')
    })

    it('stamps a finished docket and names its state, never colour alone', async () => {
      const wrapper = await mountReading(task({ completed: true }))

      expect(wrapper.get('[data-chop]').text()).toBe('完成 DONE')
      expect(factOf(wrapper, 'state')).toContain('已完成')
    })

    it('keeps the stamp out of the accessibility tree, the 狀態 cell already says it', async () => {
      const wrapper = await mountReading(task({ completed: true }))

      expect(wrapper.get('[data-chop]').attributes('aria-hidden')).toBe('true')
    })

    it('re-draws every field when the sheet is moved onto another docket', async () => {
      // The paper is filled in as the sheet opens. Moving it without re-reading
      // would leave the previous docket's title under the new number.
      const wrapper = await mountRead()

      wrapper.vm.open(task({ category: 0, sequence: 7, title: '換掉錯字' }))
      await nextTick()

      expect(wrapper.get('[data-number]').text()).toBe('feat-0007')
      expect(wrapper.get('[data-title]').text()).toBe('換掉錯字')
      expect(factOf(wrapper, 'category')).toContain('feat — 新功能')
    })
  })

  describe('說明', () => {
    it('asks the detail endpoint for the one field the shelf never held', async () => {
      await mountReading(task({ id: 'the-one-being-read' }))

      await flushPromises()

      expect(lastUrl()).toBe('/api/tasks/the-one-being-read')
    })

    it('prints the description once it lands', async () => {
      const wrapper = await mountRead()

      expect(wrapper.get('[data-description-text]').text()).toBe(
        'Vite dev server 在 5173、後端在 8080。',
      )
    })

    it('marks the block busy only while the request is out', async () => {
      // The flag is on the block, not on the window: the rest of the sheet is
      // already readable, and marking it all busy would say otherwise.
      const pending = deferred<Response>()
      fetchMock.mockReturnValueOnce(pending.promise)

      const wrapper = await mountReading()

      expect(wrapper.get('[data-description]').attributes('aria-busy')).toBe('true')

      pending.settle(jsonResponse(200, detail()))
      await flushPromises()

      expect(wrapper.get('[data-description]').attributes('aria-busy')).toBe('false')
    })

    it('says the copy is still coming, in a row that is always in the DOM', async () => {
      // A live region that arrives with its own element is one many screen readers
      // never announce, so the row stays put and only its text changes.
      const pending = deferred<Response>()
      fetchMock.mockReturnValueOnce(pending.promise)

      const wrapper = await mountReading()

      expect(wrapper.get('[data-description-status]').text()).toBe('正在取回第二聯…')

      pending.settle(jsonResponse(200, detail()))
      await flushPromises()

      expect(wrapper.find('[data-description-status]').exists()).toBe(true)
      expect(wrapper.get('[data-description-status]').text()).toBe('')
    })

    it('says a docket has no description rather than leaving the block empty', async () => {
      // An empty block reads as a description that failed to arrive; this one
      // genuinely has none, and the sheet has to tell those two apart.
      fetchMock.mockResolvedValue(jsonResponse(200, detail({ description: null })))

      const wrapper = await mountRead()

      expect(wrapper.get('[data-description-text]').text()).toBe('這張單子沒有寫說明')
    })
  })

  describe('第二聯調不出來', () => {
    it("prints the server's own reason inside the window", async () => {
      fetchMock.mockResolvedValue(refused())

      const wrapper = await mountRead()

      expect(wrapper.get('[data-description-error]').text()).toContain('第二聯調不出來')
      expect(wrapper.get('[data-description-error]').text()).toContain('第二聯的櫃子卡住了。')
    })

    it("leaves the board's own failure notice alone, since it sits behind this modal", async () => {
      // Raising the board's banner for a failure that happened inside a modal
      // reports it where nobody can see it, and it outstays the window.
      fetchMock.mockResolvedValue(refused())

      await mountRead()

      expect(useTasksStore().error).toBeNull()
    })

    it('keeps the rest of the sheet readable, because only one block failed', async () => {
      fetchMock.mockResolvedValue(refused())

      const wrapper = await mountRead()

      expect(wrapper.get('[data-title]').text()).toBe('補上 CORS 設定，讓 5173 打得到 8080')
      expect(factOf(wrapper, 'due-date')).toContain('2099-09-07')
    })

    it('asks again when 重試 is pressed, and prints what comes back', async () => {
      fetchMock.mockResolvedValueOnce(refused())

      const wrapper = await mountRead()

      await wrapper.get('[data-retry]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-description-error]').exists()).toBe(false)
      expect(wrapper.get('[data-description-text]').text()).toBe(
        'Vite dev server 在 5173、後端在 8080。',
      )
    })
  })

  describe('飛在路上的查詢', () => {
    it('drops an answer for the docket the sheet has already moved off', async () => {
      // Two cards pressed in a row. Whichever request happens to land last must
      // not decide what the window says — the docket on the paper does.
      const first = deferred<Response>()
      fetchMock.mockReturnValueOnce(first.promise)
      fetchMock.mockResolvedValue(jsonResponse(200, detail({ description: '第二張的說明' })))

      const wrapper = await mountReading()

      wrapper.vm.open(task({ id: 'the-second-one' }))
      await flushPromises()

      first.settle(jsonResponse(200, detail({ description: '第一張的說明' })))
      await flushPromises()

      expect(wrapper.get('[data-description-text]').text()).toBe('第二張的說明')
    })

    it('keeps its own answer when the window goes down and back up in one turn', async () => {
      // A browser queues `close` rather than dispatching it inline, so a card pressed in
      // the same turn as 關閉 is open before it lands — its own request must survive.

      // A fresh Response per call: this is the one test that fetches twice.
      fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, detail())))

      const wrapper = await mountReading()
      const dialog = wrapper.get('dialog').element as HTMLDialogElement

      dialog.open = false
      wrapper.vm.open(task({ id: 'the-second-one' }))
      dialog.dispatchEvent(new Event('close'))
      await flushPromises()

      expect(wrapper.find('[data-description-text]').exists()).toBe(true)
    })

    it('drops an answer that lands after the sheet has been filed back', async () => {
      // Closing invalidates the request too, or reopening on another docket would
      // flash the previous one's description into the new window.
      const pending = deferred<Response>()
      fetchMock.mockReturnValueOnce(pending.promise)

      const wrapper = await mountReading()

      wrapper.vm.close()
      pending.settle(jsonResponse(200, detail({ description: '已經收起來了' })))
      await flushPromises()

      expect(wrapper.find('[data-description-text]').exists()).toBe(false)
      expect(wrapper.get('[data-description]').attributes('aria-busy')).toBe('true')
    })
  })

  describe('關閉', () => {
    it('offers nothing but 關閉, because there is nothing here to confirm', async () => {
      // 編輯 and 刪除 stay in the row menu: putting them here would give one pair
      // of actions two entrances, and stack a modal on top of a modal.
      const wrapper = await mountRead()

      const labels = wrapper.findAll('button').map((button) => button.text())

      expect(labels).toEqual(['關閉'])
    })

    it('files the copy back and reports it', async () => {
      const wrapper = await mountRead()

      await wrapper.get('[data-close]').trigger('click')

      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('reports an Esc the same way, since reading changes nothing either way', async () => {
      const wrapper = await mountRead()

      wrapper.vm.close()
      await nextTick()

      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('puts focus on the sheet itself rather than on the way out of it', async () => {
      // This is a page to read, not a question to answer. Focusing 關閉 would open
      // the window with the reader already standing at the exit.
      const wrapper = await mountReading()

      expect(document.activeElement).toBe(wrapper.get('dialog').element)
    })
  })
})
