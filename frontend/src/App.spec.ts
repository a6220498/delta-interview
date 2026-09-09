import CardDetailDialog from '@/components/CardDetailDialog/index.vue'
import DeleteDialog from '@/components/DeleteDialog/index.vue'
import TaskDialog from '@/components/TaskDialog/index.vue'
import TaskList from '@/components/TaskList/index.vue'
import type { Task, TaskSummary } from '@/types/task'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import App from './App.vue'
import MainLayout from './layouts/MainLayout/index.vue'

const fetchMock = vi.fn<typeof fetch>()

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Returns the URL passed to the most recent `fetch` call. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

/**
 * jsdom 30 ships `<dialog>` with almost none of its behaviour, so stand-ins for the
 * two methods the sheet drives; `components/TaskDialog/index.spec.ts` tests their use.
 */
beforeEach(() => {
  // The board loads itself on mount now, so every test needs a server to
  // answer; an empty board is the default and the tests that care say so.
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(200, []))

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

/**
 * Builds one of the rows the board loads. A `TaskSummary`, not a `Task`, so no test
 * can lean on detail the shelf never receives.
 */
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

/** Builds the whole task `GET /api/tasks/{id}` answers with: the row plus its detail. */
function detail(overrides: Partial<Task> = {}): Task {
  return { ...task(), description: '前端在 5173，後端在 8080。', ...overrides }
}

/**
 * Mounts the whole board on a store of its own. A fresh pinia per mount, or a list
 * loaded in one test would still be on the board in the next.
 */
function mountBoard() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

type Board = ReturnType<typeof mountBoard>

/**
 * The task sheet's own `<dialog>`. Asked for through the component: the board mounts
 * two, and a bare tag selector would silently follow a template reorder.
 */
function sheetOf(board: Board) {
  return board.findComponent(TaskDialog).get('dialog')
}

/** The delete confirmation's own `<dialog>`. */
function confirmOf(board: Board) {
  return board.findComponent(DeleteDialog).get('dialog')
}

/** The read-only copy's own `<dialog>`. */
function copyOf(board: Board) {
  return board.findComponent(CardDetailDialog).get('dialog')
}

/**
 * Fills the sheet's one required field and presses 確定 on it. Driven through the form,
 * because the sheet files its own save and there is no event to stand in for it.
 */
async function submitSheet(board: Board, title = '補上 CORS 設定'): Promise<void> {
  const sheet = board.findComponent(TaskDialog)

  await sheet.get('[data-field="title"] input').setValue(title)
  await sheet.get('form').trigger('submit')
  await flushPromises()
}

describe('App', () => {
  it('mounts the masthead into the layout header landmark rather than the content area', () => {
    // The masthead has to take the header slot, or the page ships its title
    // inside <main> and the landmark it left behind is empty.
    const wrapper = mountBoard()

    expect(wrapper.get('header').text()).toContain('任務管理應用程式')
    expect(wrapper.get('main').text()).not.toContain('任務管理應用程式')
  })

  it('hangs both racks in the content area, in-tray before out-tray', () => {
    // The table's order is the order a reader meets the shelves in. Literal ids, not
    // `TASK_RACKS`: an expectation read from the same table would pass regardless.
    const wrapper = mountBoard()

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

  it('gives each rack only the tasks that belong on it', async () => {
    // The rule the store had to arrive without breaking: a loaded task lands on
    // exactly one shelf — none on both, none missing from both.
    fetchMock.mockResolvedValue(
      jsonResponse(200, [task({ id: 'a' }), task({ id: 'b', completed: true })]),
    )
    const wrapper = mountBoard()
    await flushPromises()

    const [open, done] = wrapper.findAllComponents(TaskList)

    expect(open?.props('tasks').map((filed) => filed.id)).toEqual(['a'])
    expect(done?.props('tasks').map((filed) => filed.id)).toEqual(['b'])
  })

  describe('檢視任務', () => {
    it('asks the server for the whole board as soon as it mounts', async () => {
      // No `completed` parameter: the board hangs both shelves, so filtering
      // server-side here would mean two round trips for one screen.
      mountBoard()
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(lastUrl()).toBe('/api/tasks')
    })

    it('draws the dockets it loaded', async () => {
      // Through the rendered text rather than the props above, because the
      // other half of the claim is that a loaded task reaches the card.
      fetchMock.mockResolvedValue(jsonResponse(200, [task()]))
      const wrapper = mountBoard()
      await flushPromises()

      expect(wrapper.get('main').text()).toContain('補上 CORS 設定')
    })

    it('tells the shelves the first load is still running', async () => {
      // Otherwise both trays claim 架上沒有單子 for as long as the request takes,
      // which invites someone to re-open a task they already have.
      fetchMock.mockReturnValue(new Promise<Response>(() => {}))
      const wrapper = mountBoard()
      await nextTick()

      expect(wrapper.findAllComponents(TaskList).map((tray) => tray.props('loading'))).toEqual([
        true,
        true,
      ])
    })

    it('drops the loading flag once the board is back', async () => {
      const wrapper = mountBoard()
      await flushPromises()

      expect(wrapper.findComponent(TaskList).props('loading')).toBe(false)
    })

    it('says why the board is empty when the load fails', async () => {
      // The reason comes from the backend's problem detail: "沒載到" without it
      // leaves the reader with nothing to act on.
      fetchMock.mockResolvedValue(
        jsonResponse(500, { status: 500, title: 'Server error', detail: '資料庫連線失敗。' }),
      )
      const wrapper = mountBoard()
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toContain('資料庫連線失敗。')
    })

    it('keeps no failure notice on a board that loaded', async () => {
      const wrapper = mountBoard()
      await flushPromises()

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })

    it('runs the load again when 重試 is pressed, and takes the notice away', async () => {
      // The whole point of the button: a backend that was down at first paint
      // must not need a page reload once it is up.
      fetchMock.mockResolvedValue(jsonResponse(503, { status: 503, title: 'Unavailable' }))
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, [task()]))
      await wrapper.get('[data-retry]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.get('main').text()).toContain('補上 CORS 設定')
    })
  })

  describe('工單彈窗', () => {
    it('keeps the sheet mounted but down until something asks for it', () => {
      // Mounted, because `<dialog>` returns focus only while still in the document;
      // down, because the board is what the page opens on.
      const wrapper = mountBoard()

      expect(wrapper.findAllComponents(TaskDialog)).toHaveLength(1)
      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
    })

    it("opens a blank sheet from the layout's primary action", async () => {
      // The layout reports the press and decides nothing, so this wiring is the
      // only thing that turns 新增工單 into an open sheet.
      const wrapper = mountBoard()

      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      expect(sheetOf(wrapper).attributes('open')).toBeDefined()
      expect(sheetOf(wrapper).get('h2').text()).toBe('新增工單')
      expect(sheetOf(wrapper).get('[data-number]').text()).toBe('NEW')
    })

    it('opens an edit sheet on the task whose docket was asked about', async () => {
      // The tray attaches the row on the way up. Asserted through the sheet's own
      // fields: the task is handed over in the call that opens it, not in a prop.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      wrapper.findComponent(TaskList).vm.$emit('edit', task())
      await flushPromises()

      expect(sheetOf(wrapper).attributes('open')).toBeDefined()
      expect(sheetOf(wrapper).get('h2').text()).toBe('編輯工單')
      expect(sheetOf(wrapper).get('[data-number]').text()).toBe('bug-0012')
      expect(wrapper.get<HTMLInputElement>('[data-field="title"] input').element.value).toBe(
        '補上 CORS 設定',
      )
    })

    it('fetches the docket before opening it, because the shelf never held its detail', async () => {
      // Rows come back without a description, so 說明 can only be filled from
      // `GET /api/tasks/{id}`; without it, saving would clear unseen detail.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      wrapper.findComponent(TaskList).vm.$emit('edit', task())
      await flushPromises()

      expect(lastUrl()).toBe('/api/tasks/3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31')
      expect(
        wrapper.get<HTMLTextAreaElement>('[data-field="description"] textarea').element.value,
      ).toBe('前端在 5173，後端在 8080。')
    })

    it('keeps the sheet down when the docket cannot be fetched, and says why', async () => {
      // A sheet opened on half a task is worse than no sheet: it would show an
      // empty 說明 for a task that has one. The reader gets the reason instead.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )
      wrapper.findComponent(TaskList).vm.$emit('edit', task())
      await flushPromises()

      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
      expect(wrapper.get('[role="alert"]').text()).toContain('這張單子已經不在了。')
    })

    it('opens the same sheet blank again after an edit', async () => {
      // One sheet moved between jobs, so 新增工單 after an edit has to arrive blank.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      wrapper.findComponent(TaskList).vm.$emit('edit', task())
      await flushPromises()
      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      expect(sheetOf(wrapper).get('h2').text()).toBe('新增工單')
      expect(wrapper.get<HTMLInputElement>('[data-field="title"] input').element.value).toBe('')
    })

    it('draws a docket the sheet filed, without loading the board again', async () => {
      // The only part of a save that is the board's: nothing is bound between the
      // two, so what puts the new docket on the shelf is the store they share.
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      fetchMock.mockResolvedValue(jsonResponse(201, detail({ id: 'new', title: '新的單子' })))
      await submitSheet(wrapper, '新的單子')

      expect(wrapper.get('main').text()).toContain('新的單子')
      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
      // One load and one POST: the create response is the whole task, so refetching
      // would be a second round trip for what the request just returned.
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('工單明細', () => {
    it('keeps the copy mounted but down until a card is pressed', () => {
      const wrapper = mountBoard()

      expect(wrapper.findAllComponents(CardDetailDialog)).toHaveLength(1)
      expect(copyOf(wrapper).attributes('open')).toBeUndefined()
    })

    it('opens the copy on the docket whose card was pressed', async () => {
      // The tray attaches the row on the way up; this wiring is the only thing
      // that turns pressing a card into a window that can be read.
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(TaskList).vm.$emit('detail', task())
      await flushPromises()

      expect(copyOf(wrapper).attributes('open')).toBeDefined()
      expect(copyOf(wrapper).get('[data-number]').text()).toBe('bug-0012')
      expect(copyOf(wrapper).get('[data-title]').text()).toBe('補上 CORS 設定')
    })

    it('hands the row straight over, because the window fetches its own 說明', async () => {
      // Unlike 編輯, nothing is awaited before opening: the row draws the whole
      // window but one block, and only that block has any reason to wait.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      wrapper.findComponent(TaskList).vm.$emit('detail', task())
      await nextTick()

      expect(copyOf(wrapper).attributes('open')).toBeDefined()

      await flushPromises()

      expect(lastUrl()).toBe('/api/tasks/3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31')
      expect(copyOf(wrapper).get('[data-description-text]').text()).toBe(
        '前端在 5173，後端在 8080。',
      )
    })

    it('keeps the copy open when the 說明 cannot be fetched, and says so inside it', async () => {
      // The opposite of 編輯, which stays down: five of this window's six fields
      // are already in hand, and the board's own notice would be behind the modal.
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(
        jsonResponse(500, { status: 500, title: 'Server Error', detail: '櫃子卡住了。' }),
      )
      wrapper.findComponent(TaskList).vm.$emit('detail', task())
      await flushPromises()

      expect(copyOf(wrapper).attributes('open')).toBeDefined()
      expect(copyOf(wrapper).get('[data-description-error]').text()).toContain('櫃子卡住了。')
      expect(wrapper.find('main [role="alert"]').exists()).toBe(false)
    })
  })

  describe('標記完成', () => {
    it('moves a stamped docket from the in-tray onto the 已完成 shelf', async () => {
      // The point of the whole wiring, and the one claim no unit test can make:
      // nothing is bound between the card and the board, so what carries the docket
      // across is the row the store swapped in.
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail({ id: 'a', completed: true })))
      await wrapper.get('main [aria-pressed]').trigger('click')
      await flushPromises()

      const [open, done] = wrapper.findAllComponents(TaskList)

      expect(open?.text()).not.toContain('補上 CORS 設定')
      expect(done?.text()).toContain('補上 CORS 設定')
      // One load and one PATCH: the answer is the whole task, so reloading the
      // board would be a second round trip for what the request just returned.
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('takes a reopened docket back to the in-tray', async () => {
      // The same seam in the other direction: 已完成 is a state a reader can undo,
      // and a shelf that only ever gains dockets would strand them there.
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a', completed: true })]))
      const wrapper = mountBoard()
      await flushPromises()

      fetchMock.mockResolvedValue(jsonResponse(200, detail({ id: 'a', completed: false })))
      await wrapper.get('main [aria-pressed]').trigger('click')
      await flushPromises()

      const [open, done] = wrapper.findAllComponents(TaskList)

      expect(open?.text()).toContain('補上 CORS 設定')
      expect(done?.text()).not.toContain('補上 CORS 設定')
    })
  })

  describe('刪除確認', () => {
    it('keeps the confirmation mounted but down, alongside the sheet', () => {
      // Both mounted from first paint, so the browser can hand focus back to
      // whatever raised them.
      const wrapper = mountBoard()

      expect(wrapper.findAllComponents(DeleteDialog)).toHaveLength(1)
      expect(confirmOf(wrapper).attributes('open')).toBeUndefined()
      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
    })

    it('raises the confirmation on the docket the row asked about', async () => {
      // The row menu reports 刪除 and decides nothing, so this wiring is the only
      // thing that turns it into a question — and it has to name the right docket.
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(TaskList).vm.$emit('delete', task())
      await nextTick()

      expect(confirmOf(wrapper).attributes('open')).toBeDefined()
      expect(confirmOf(wrapper).get('[data-number]').text()).toBe('bug-0012')
      expect(confirmOf(wrapper).get('[data-quote]').text()).toBe('補上 CORS 設定')
    })

    it('asks the question without fetching the docket first', async () => {
      // Unlike 編輯: the question shows a number and a title, both of which the row
      // already carries, so a second GET would buy the reader nothing.
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(TaskList).vm.$emit('delete', task())
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(lastUrl()).toBe('/api/tasks')
    })

    it('takes a docket the confirmation deleted off the shelf', async () => {
      // The seam: nothing is bound between the two, so what clears the row is the
      // store they share, and the 204 settles it without a second load.
      fetchMock.mockResolvedValue(
        jsonResponse(200, [task({ id: 'a' }), task({ id: 'b', title: '換掉錯字' })]),
      )
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(TaskList).vm.$emit('delete', task({ id: 'b', title: '換掉錯字' }))
      await nextTick()

      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
      await wrapper.findComponent(DeleteDialog).get('[data-confirm]').trigger('click')
      await flushPromises()

      expect(wrapper.get('main').text()).not.toContain('換掉錯字')
      expect(wrapper.get('main').text()).toContain('補上 CORS 設定')
      expect(confirmOf(wrapper).attributes('open')).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
