import type { Task, TaskSummary } from '@/types/task'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTasksStore } from './tasks'

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

/**
 * Builds one of the rows the list endpoint answers with.
 *
 * `satisfies TaskSummary` rather than a loose object literal: the contract owns
 * this shape, so a field added to `api/openapi.yaml` fails the type check here
 * instead of letting the store be tested against a row the server never sends.
 * It also holds on to the point of this fixture — there is no `description` on
 * it, because the list does not carry one.
 */
function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    // 0 = feature，1 = bug；對照表在 api/openapi.yaml 的 TaskCategory。
    category: 0,
    sequence: 3,
    title: '補上 CORS 設定',
    completed: false,
    dueDate: null,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  } satisfies TaskSummary
}

/**
 * Builds the whole task that `GET /api/tasks/{id}` answers with.
 *
 * The same row plus the one field the shelf never carries. Given a description
 * rather than defaulting it to `null`, because a detail that cannot be told
 * apart from the row it came from would let the assertions below pass against
 * a fetch that never happened.
 */
function detail(overrides: Partial<Task> = {}): Task {
  return {
    ...task(),
    description: '把 8080 的 CORS 設定補上，5173 才打得到。',
    ...overrides,
  } satisfies Task
}

/** Returns the URL passed to the most recent `fetch` call. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

beforeEach(() => {
  // A store per test: Pinia keeps one instance per pinia, and a shared one
  // would let a list loaded in one test satisfy the next test's assertion.
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('tasks store', () => {
  describe('fetchTasks', () => {
    it('files the contract list endpoint\'s answer into the store', async () => {
      const loaded = [task({ id: 'a' }), task({ id: 'b', completed: true })]
      fetchMock.mockResolvedValue(jsonResponse(200, loaded))
      const store = useTasksStore()

      await store.fetchTasks()

      expect(lastUrl()).toBe('/api/tasks')
      expect(store.taskList).toEqual(loaded)
    })

    it('replaces the previous list rather than appending to it', async () => {
      // A refresh answers "what is on the board now"; concatenating would show
      // every task twice after the second load.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' }), task({ id: 'b' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      await store.fetchTasks()

      expect(store.taskList).toHaveLength(1)
    })

    it('hands the filter to the server instead of trimming the list here', async () => {
      // The contract carries a `completed` parameter precisely so a large task
      // set never crosses the wire just to be discarded in the browser.
      fetchMock.mockResolvedValue(jsonResponse(200, []))
      const store = useTasksStore()

      await store.fetchTasks('active')

      expect(lastUrl()).toBe('/api/tasks?completed=false')
    })

    it('flags loading for exactly as long as the request is in flight', async () => {
      // The board draws its "still coming" state off this flag; left up after
      // the answer arrives it would say loading forever, and left down during
      // the first load the empty shelves would claim there are no tasks.
      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => { settle = resolve }))
      const store = useTasksStore()

      const pending = store.fetchTasks()
      expect(store.loading).toBe(true)

      settle(jsonResponse(200, [task()]))
      await pending

      expect(store.loading).toBe(false)
    })
  })

  describe('when the load fails', () => {
    it('keeps the problem detail as the reason, so the board can say what happened', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(500, { status: 500, title: 'Server error', detail: '資料庫連線失敗。' }),
      )
      const store = useTasksStore()

      await store.fetchTasks()

      expect(store.error).toBe('資料庫連線失敗。')
      expect(store.loading).toBe(false)
    })

    it('reports a transport failure the same way as a rejected status', async () => {
      // `fetch` rejects with a TypeError when the backend is not running at
      // all, which is the most likely failure in development — it has to land
      // in the same state as a 500 rather than escaping as an unhandled
      // rejection.
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const store = useTasksStore()

      await store.fetchTasks()

      expect(store.error).toBe('Failed to fetch')
      expect(store.loading).toBe(false)
    })

    it('settles rather than rejecting, so a caller needs no catch of its own', async () => {
      // The failure is state, not an exception: the board renders `error` and
      // `onMounted` can call this without a floating rejection.
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const store = useTasksStore()

      await expect(store.fetchTasks()).resolves.toBeUndefined()
    })

    it('leaves the last good list on the board', async () => {
      // A failed refresh means "we could not check", not "the tasks are gone";
      // blanking the board would lose work the server still holds.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task()]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))
      await store.fetchTasks()

      expect(store.taskList).toHaveLength(1)
    })

    it('clears the error once a later load succeeds', async () => {
      // Otherwise the failure notice outlives the failure and the board shows
      // a red bar above a list that loaded perfectly well.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500, title: 'Server error' }))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(200, [task()]))
      await store.fetchTasks()

      expect(store.error).toBeNull()
    })
  })

  describe('fetchTask', () => {
    const ID = '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31'

    it('asks the single-task endpoint for the detail the list leaves out', async () => {
      // The whole reason this exists: the rows carry no description, so the
      // only place the edit sheet can get one is this second request.
      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      const store = useTasksStore()

      const fetched = await store.fetchTask(ID)

      expect(lastUrl()).toBe(`/api/tasks/${ID}`)
      expect(fetched?.description).toBe('把 8080 的 CORS 設定補上，5173 才打得到。')
    })

    it('leaves the shelves alone while it runs: one docket is not the board', async () => {
      // `loading` is what makes both trays say 載入中 over their empty box, so
      // opening one docket must not claim the whole board is being refetched.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      await store.fetchTasks()

      let settle: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(
        new Promise<Response>((resolve) => {
          settle = resolve
        }),
      )
      const pending = store.fetchTask(ID)

      expect(store.loading).toBe(false)

      settle(jsonResponse(200, detail()))
      await pending

      expect(store.taskList.map((filed) => filed.id)).toEqual(['a'])
    })

    it('hands back null rather than throwing when the docket cannot be fetched', async () => {
      // So the caller opens the sheet behind an `if` and needs no catch of its
      // own — the same bargain `fetchTasks` makes with its own failures.
      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )
      const store = useTasksStore()

      await expect(store.fetchTask(ID)).resolves.toBeNull()
    })

    it('says why the docket could not be opened', async () => {
      // Otherwise pressing 編輯 does nothing at all, and nothing is the one
      // outcome a reader cannot tell apart from a broken button.
      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )
      const store = useTasksStore()

      await store.fetchTask(ID)

      expect(store.error).toBe('這張單子已經不在了。')
    })
  })
})
