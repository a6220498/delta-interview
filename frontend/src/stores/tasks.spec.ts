import type { Task } from '@/types/task'
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
 * Builds a task fixture.
 *
 * `satisfies Task` rather than a loose object literal: the contract owns this
 * shape, so a field added to `api/openapi.yaml` fails the type check here
 * instead of letting the store be tested against a task the server never sends.
 */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    // 0 = feature，1 = bug；對照表在 api/openapi.yaml 的 TaskCategory。
    category: 0,
    sequence: 3,
    title: '補上 CORS 設定',
    description: null,
    completed: false,
    dueDate: null,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
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
      expect(store.tasks).toEqual(loaded)
    })

    it('replaces the previous list rather than appending to it', async () => {
      // A refresh answers "what is on the board now"; concatenating would show
      // every task twice after the second load.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' }), task({ id: 'b' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      await store.fetchTasks()

      expect(store.tasks).toHaveLength(1)
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

      expect(store.tasks).toHaveLength(1)
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
})
