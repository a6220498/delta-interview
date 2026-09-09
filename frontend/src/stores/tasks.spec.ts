import type { CreateTaskRequest, Task, TaskSummary, UpdateTaskRequest } from '@/types/task'
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
 * Builds one of the rows the list endpoint answers with. `satisfies TaskSummary` so a
 * field added to `api/openapi.yaml` fails the type check here; note the missing detail.
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
 * Builds the whole task `GET /api/tasks/{id}` answers with: the row plus its detail.
 * Given a description, or the assertions below would pass on a fetch that never ran.
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

/** Returns the options passed to the most recent `fetch` call. */
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {}
}

/** Returns the JSON body of the most recent `fetch` call. */
function lastBody(): unknown {
  return JSON.parse(String(lastInit().body))
}

/**
 * The four fields the sheet hands up, typed as both request bodies at once exactly as
 * the sheet types them, so a field added to one schema fails here.
 */
function values(
  overrides: Partial<CreateTaskRequest> = {},
): CreateTaskRequest & UpdateTaskRequest {
  return {
    title: '補上 CORS 設定',
    description: '把 8080 的 CORS 設定補上，5173 才打得到。',
    category: 1,
    dueDate: null,
    ...overrides,
  }
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
      // Left up after the answer arrives it would say loading forever; left down
      // during the first load, the empty shelves would claim there are no tasks.
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
      // `fetch` rejects with a TypeError when the backend is down, and that has to
      // land in the same state as a 500 rather than escape as an unhandled rejection.
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
  describe('createTask', () => {
    it("posts the sheet's values to the contract's create endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, detail()))
      const store = useTasksStore()

      await store.createTask(values())

      expect(lastUrl()).toBe('/api/tasks')
      expect(lastInit().method).toBe('POST')
      expect(lastBody()).toEqual(values())
    })

    it('files what the server answered rather than what was typed', async () => {
      // The id and the serial are the server's to assign, so a row built from the
      // payload would be a guess at both until the next refresh.
      fetchMock.mockResolvedValue(jsonResponse(201, detail({ id: 'server-side', sequence: 9 })))
      const store = useTasksStore()

      await store.createTask(values())

      expect(store.taskList.map((filed) => filed.id)).toEqual(['server-side'])
      expect(store.taskList[0]?.sequence).toBe(9)
    })

    it('puts the new docket on top, where the list order says it belongs', async () => {
      // The contract lists tasks newest first, and nothing is newer than one created
      // a moment ago; filing it elsewhere would move it on the next refresh.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'older' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(201, detail({ id: 'newest' })))
      await store.createTask(values())

      expect(store.taskList.map((filed) => filed.id)).toEqual(['newest', 'older'])
    })

    it('throws rather than turning a refused save into board state', async () => {
      // Nothing about the board failed, and the reason belongs on the sheet the caller
      // holds. In `error` it would raise 工單載不出來 over a board that loaded fine.
      fetchMock.mockResolvedValue(
        jsonResponse(400, { status: 400, title: 'Bad Request', detail: '標題不能空白。' }),
      )
      const store = useTasksStore()

      await expect(store.createTask(values())).rejects.toThrow('標題不能空白。')
      expect(store.error).toBeNull()
      expect(store.taskList).toEqual([])
    })
  })

  describe('updateTask', () => {
    const ID = '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31'

    it("puts the values to the docket's own endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, detail()))
      const store = useTasksStore()

      await store.updateTask(ID, values())

      expect(lastUrl()).toBe(`/api/tasks/${ID}`)
      expect(lastInit().method).toBe('PUT')
      expect(lastBody()).toEqual(values())
    })

    it('swaps the stored row for the answer, leaving it where it was', async () => {
      // The response is not always the request: re-categorising re-issues the serial,
      // and only the response carries it. `createdAt` order an edit cannot change.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' }), task({ id: 'b' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(
        jsonResponse(200, detail({ id: 'b', title: '改過的標題', category: 1, sequence: 7 })),
      )
      await store.updateTask('b', values({ title: '改過的標題' }))

      expect(store.taskList.map((filed) => filed.id)).toEqual(['a', 'b'])
      expect(store.taskList[1]?.title).toBe('改過的標題')
      expect(store.taskList[1]?.sequence).toBe(7)
    })

    it('leaves the board untouched when the save is refused', async () => {
      // A save that did not happen has changed nothing, and a row rewritten
      // here would claim otherwise until someone refreshed.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a', title: '原本的標題' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )

      await expect(store.updateTask('a', values())).rejects.toThrow('這張單子已經不在了。')
      expect(store.taskList[0]?.title).toBe('原本的標題')
      expect(store.error).toBeNull()
    })
  })

  describe('setTaskCompletion', () => {
    const ID = '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31'

    it("patches the asked-for state to the docket's completion endpoint", async () => {
      // The target state travels in the body rather than being derived from the row
      // here, so two presses in a breath ask for the same thing instead of racing.
      fetchMock.mockResolvedValue(jsonResponse(200, detail({ completed: true })))
      const store = useTasksStore()

      await store.setTaskCompletion(ID, true)

      expect(lastUrl()).toBe(`/api/tasks/${ID}/completion`)
      expect(lastInit().method).toBe('PATCH')
      expect(lastBody()).toEqual({ completed: true })
    })

    it('swaps the stamped row for the answer, leaving it where it was', async () => {
      // The board hangs its shelves by filtering `completed`, so this swap is the
      // whole reason a stamped docket crosses to 已完成 without a reload.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' }), task({ id: 'b' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(jsonResponse(200, detail({ id: 'b', completed: true })))
      await store.setTaskCompletion('b', true)

      expect(store.taskList.map((filed) => filed.id)).toEqual(['a', 'b'])
      expect(store.taskList.map((filed) => filed.completed)).toEqual([false, true])
    })

    it('leaves the board untouched when the stamp is refused', async () => {
      // A stamp that did not happen has changed nothing; a row flipped here would
      // move the docket to the other shelf over a task the server never marked.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )

      await expect(store.setTaskCompletion('a', true)).rejects.toThrow('這張單子已經不在了。')
      expect(store.taskList[0]?.completed).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('deleteTask', () => {
    const ID = '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31'

    it("sends a DELETE to the docket's own endpoint", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
      const store = useTasksStore()

      await store.deleteTask(ID)

      expect(lastUrl()).toBe(`/api/tasks/${ID}`)
      expect(lastInit().method).toBe('DELETE')
    })

    it('takes the deleted row off the board and leaves the rest where they were', async () => {
      // The 204 answers with no list, so this is what keeps the shelves honest
      // short of refetching the whole board for one row that is known to be gone.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(
        jsonResponse(200, [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]),
      )
      await store.fetchTasks()

      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
      await store.deleteTask('b')

      expect(store.taskList.map((filed) => filed.id)).toEqual(['a', 'c'])
    })

    it('leaves the board untouched when the delete is refused', async () => {
      // A row taken off here would hide a task the server still holds, and the
      // reason belongs on the confirmation the caller is still holding up.
      const store = useTasksStore()
      fetchMock.mockResolvedValue(jsonResponse(200, [task({ id: 'a' })]))
      await store.fetchTasks()

      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )

      await expect(store.deleteTask('a')).rejects.toThrow('這張單子已經不在了。')
      expect(store.taskList.map((filed) => filed.id)).toEqual(['a'])
      expect(store.error).toBeNull()
    })
  })
})
