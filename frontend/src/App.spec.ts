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
 * jsdom 30 ships `<dialog>` as an element but almost none of its behaviour, so
 * opening the sheet would throw before a single assertion ran. Stand-ins for
 * the two methods the sheet drives; see `components/TaskDialog/index.spec.ts`,
 * which tests what the sheet does with them.
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
 * Builds one of the rows the board loads; only the fields it reads are varied.
 *
 * A `TaskSummary` and not a `Task`, because that is what `GET /api/tasks`
 * answers with: no `description` on it at all. The board's fixtures say so, so
 * a test cannot lean on detail the shelf never receives.
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
 * Mounts the whole board on a store of its own.
 *
 * A fresh pinia per mount rather than one shared across the file: Pinia keeps
 * a store instance per pinia, and a list loaded in one test would otherwise
 * still be on the board in the next one.
 */
function mountBoard() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

type Board = ReturnType<typeof mountBoard>

/**
 * The task sheet's own `<dialog>`, and the confirmation's.
 *
 * Asked for through the component rather than with `get('dialog')`: the board
 * mounts two dialogs now, and a bare tag selector takes whichever is written
 * first — these assertions would go on passing while pointing at the other
 * sheet the first time the template is reordered.
 */
function sheetOf(board: Board) {
  return board.findComponent(TaskDialog).get('dialog')
}

/** The delete confirmation's own `<dialog>`. */
function confirmOf(board: Board) {
  return board.findComponent(DeleteDialog).get('dialog')
}

/**
 * Fills the sheet's one required field and presses 確定 on it.
 *
 * Driven through the sheet's own form rather than through an event, because
 * there is no longer an event: the sheet files what is typed on it, so the only
 * way in from out here is the way a person takes.
 */
async function submitSheet(board: Board, title = '補上 CORS 設定'): Promise<void> {
  const sheet = board.findComponent(TaskDialog)

  await sheet.get('[data-field="title"] input').setValue(title)
  await sheet.get('form').trigger('submit')
  await flushPromises()
}

describe('App', () => {
  it('mounts the masthead into the layout header landmark rather than the content area', () => {
    // The wiring is the thing under test: the layout exposes two insertion
    // points and the masthead has to take the header one, or the page ships
    // its title inside <main> and the landmark it left behind is empty.
    const wrapper = mountBoard()

    expect(wrapper.get('header').text()).toContain('任務管理應用程式')
    expect(wrapper.get('main').text()).not.toContain('任務管理應用程式')
  })

  it('hangs both racks in the content area, in-tray before out-tray', () => {
    // The two trays are one component rendered once per row of the rack table,
    // so the table's order is the order a reader meets the shelves in. Asserted
    // against the literal ids rather than against `TASK_RACKS` itself: an
    // expectation read from the same table the loop reads would pass however
    // the table is rewritten.
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
      // Mounted, because `<dialog>` returns focus to whatever opened it and can
      // only do that while it is still in the document; down, because the board
      // is what the page opens on. One element serves both jobs — it is opened
      // by name, so there is no second sheet to keep in step with this one.
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
      // 編輯 is chosen in the card's own row menu; the tray attaches the row on
      // the way up, and the board is what turns that into a sheet carrying the
      // values to correct. Asserted through the sheet's own fields rather than
      // through a prop, because there is no longer a prop to assert on — the
      // task is handed over in the call that opens it.
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
      // The rows come back without a description, so the 說明 field can only be
      // filled from `GET /api/tasks/{id}`. Without this request the sheet would
      // open on a blank description and saving it would clear detail the person
      // was never shown.
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
      // The board holds one sheet and moves it between jobs, so 新增工單 pressed
      // after an edit has to arrive at a blank form rather than at the last task
      // opened.
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
      // The seam, and the only part of a save that is the board's: nothing is
      // bound between the two — the sheet files its own — so what puts the new
      // docket on the shelf is the store they share.
      const wrapper = mountBoard()
      await flushPromises()

      wrapper.findComponent(MainLayout).vm.$emit('action')
      await nextTick()

      fetchMock.mockResolvedValue(jsonResponse(201, detail({ id: 'new', title: '新的單子' })))
      await submitSheet(wrapper, '新的單子')

      expect(wrapper.get('main').text()).toContain('新的單子')
      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
      // One load on mount and one POST, nothing more: the create response is
      // the whole task, so refetching the board would be a second round trip to
      // learn what the request has just returned.
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('刪除確認', () => {
    it('keeps the confirmation mounted but down, alongside the sheet', () => {
      // Two dialogs on the page from the first paint, both waiting to be asked
      // for: the confirmation is mounted for the same reason the sheet is, so
      // the browser can hand focus back to whatever raised it.
      const wrapper = mountBoard()

      expect(wrapper.findAllComponents(DeleteDialog)).toHaveLength(1)
      expect(confirmOf(wrapper).attributes('open')).toBeUndefined()
      expect(sheetOf(wrapper).attributes('open')).toBeUndefined()
    })

    it('closes the confirmation when it is answered', async () => {
      // Raised through the component's own `open()` rather than through the
      // board, because nothing on the board reaches it yet — see the test
      // below. What is under test is the other half of the wiring: that an
      // answered question is taken away by the board rather than by the
      // confirmation itself.
      const wrapper = mountBoard()
      const confirmation = wrapper.findComponent(DeleteDialog)

      confirmation.vm.open(task())
      await nextTick()
      expect(confirmOf(wrapper).attributes('open')).toBeDefined()

      confirmation.vm.$emit('confirm', task())
      await nextTick()

      expect(confirmOf(wrapper).attributes('open')).toBeUndefined()
    })

    it('leaves 刪除 unwired for now, so nothing on the board can raise it', async () => {
      // Deliberate, and pinned so it is noticed when it changes: the row menu
      // reports 刪除 as it should, and the board does not listen. The step that
      // connects the two is the step that has somewhere to delete the task
      // from.
      const wrapper = mountBoard()

      wrapper.findComponent(TaskList).vm.$emit('delete', task())
      await nextTick()

      expect(confirmOf(wrapper).attributes('open')).toBeUndefined()
    })

    it('takes nothing off the board when a delete is confirmed', async () => {
      // Only closes it. Removing the task is the store's step, and a board that
      // forgot a task the server still holds would put it back on the next load.
      const wrapper = mountBoard()
      const before = wrapper.findComponent(TaskList).props('tasks')

      wrapper.findComponent(DeleteDialog).vm.$emit('confirm', task())
      await nextTick()

      expect(wrapper.findComponent(TaskList).props('tasks')).toEqual(before)
    })
  })
})
