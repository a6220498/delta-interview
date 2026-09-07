import type { Task } from '@/types/task'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './http'
import { createTask, deleteTask, listTasks, setTaskCompletion, updateTask } from './tasks'

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

// [AI assisted 003] 使用 AI 協助把測試替身補上 category / sequence / dueDate，並改用
// `satisfies Task` 綁住契約 —— 契約日後再加欄位，這裡會直接型別檢查失敗而不是默默失真。
// [AI assisted 005] category 改成數字碼後，`satisfies Task` 正是抓出這幾處替身要改的地方。
const sampleTask = {
  id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
  // 0 = feature，1 = bug；對照表在 api/openapi.yaml 的 TaskCategory。
  category: 0,
  sequence: 3,
  title: 'Write the contract',
  description: null,
  completed: false,
  dueDate: null,
  createdAt: '2026-09-06T10:00:00Z',
  updatedAt: '2026-09-06T10:00:00Z',
} satisfies Task

/** Returns the URL passed to the most recent `fetch` call. */
function lastUrl(): string {
  return String(fetchMock.mock.calls.at(-1)?.[0])
}

/** Returns the request init passed to the most recent `fetch` call. */
function lastInit(): RequestInit {
  return (fetchMock.mock.calls.at(-1)?.[1] ?? {}) as RequestInit
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

describe('tasks api', () => {
  describe('listTasks', () => {
    it('sends no query string for "all", so the backend is not asked to filter on a non-choice', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, [sampleTask]))

      await listTasks('all')

      expect(lastUrl()).toBe('/api/tasks')
    })

    it.each([
      ['completed', 'true'],
      ['active', 'false'],
    ] as const)('translates the %s filter into completed=%s', async (filter, expected) => {
      fetchMock.mockResolvedValue(jsonResponse(200, []))

      await listTasks(filter)

      expect(lastUrl()).toBe(`/api/tasks?completed=${expected}`)
    })
  })

  describe('createTask', () => {
    it('posts the contract payload and returns the created task', async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, sampleTask))

      const created = await createTask({ title: 'Write the contract', category: 0 })

      expect(lastInit().method).toBe('POST')
      // The category picks the serial's counter, so it travels with the create…
      expect(JSON.parse(String(lastInit().body))).toEqual({ title: 'Write the contract', category: 0 })
      // …but the serial itself is the server's to assign and is never sent.
      expect(JSON.parse(String(lastInit().body))).not.toHaveProperty('sequence')
      expect(created).toEqual(sampleTask)
    })
  })

  describe('updateTask', () => {
    it('PUTs to the task resource', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, sampleTask))

      await updateTask(sampleTask.id, { title: 'renamed', category: 0 })

      expect(lastUrl()).toBe(`/api/tasks/${sampleTask.id}`)
      expect(lastInit().method).toBe('PUT')
    })
  })

  describe('setTaskCompletion', () => {
    it('PATCHes the dedicated completion resource with an explicit target state', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { ...sampleTask, completed: true }))

      const updated = await setTaskCompletion(sampleTask.id, true)

      expect(lastUrl()).toBe(`/api/tasks/${sampleTask.id}/completion`)
      expect(lastInit().method).toBe('PATCH')
      // Explicit state, never a toggle: a double click must not undo itself.
      expect(JSON.parse(String(lastInit().body))).toEqual({ completed: true })
      expect(updated.completed).toBe(true)
    })
  })

  describe('deleteTask', () => {
    it('resolves on 204 without trying to parse an empty body', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

      await expect(deleteTask(sampleTask.id)).resolves.toBeUndefined()
      expect(lastInit().method).toBe('DELETE')
    })
  })

  describe('error handling', () => {
    it('raises ApiError carrying the problem detail, so the UI can show the real reason', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Task not found', detail: 'No task exists with id x.' }),
      )

      const error = await getTaskError()

      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(404)
      expect(error.message).toContain('No task exists with id x.')
    })

    it('still raises ApiError when the error body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }))

      const error = await getTaskError()

      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(502)
    })
  })
})

/** Runs a failing request and returns the thrown ApiError. */
async function getTaskError(): Promise<ApiError> {
  try {
    await listTasks('all')
  } catch (error) {
    return error as ApiError
  }
  throw new Error('expected the request to reject')
}
