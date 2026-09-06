import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/http'
import type { Task } from '@/types/task'

import { useTaskStore } from './tasks'

vi.mock('@/api/tasks', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  setTaskCompletion: vi.fn(),
  deleteTask: vi.fn(),
}))

const api = vi.mocked(await import('@/api/tasks'))

/** Builds a task with sane defaults so each test states only what it cares about. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    title: 'Write the contract',
    description: null,
    completed: false,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('task store', () => {
  it('exposes loaded tasks and clears the loading flag', async () => {
    const task = makeTask()
    api.listTasks.mockResolvedValue([task])
    const store = useTaskStore()

    const pending = store.load()
    expect(store.isLoading).toBe(true)

    await pending
    expect(store.tasks).toEqual([task])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('re-queries the backend when the filter changes instead of filtering locally', async () => {
    api.listTasks.mockResolvedValue([])
    const store = useTaskStore()

    await store.setFilter('completed')

    // The contract's `completed` parameter would be dead code if the store
    // filtered client-side — and a large list would cross the wire for nothing.
    expect(api.listTasks).toHaveBeenCalledWith('completed')
    expect(store.filter).toBe('completed')
  })

  it('surfaces the failure reason and leaves the previous tasks intact', async () => {
    const task = makeTask()
    api.listTasks.mockResolvedValueOnce([task])
    const store = useTaskStore()
    await store.load()

    api.listTasks.mockRejectedValueOnce(new ApiError(503, 'Service Unavailable'))
    await store.load()

    expect(store.error).toContain('Service Unavailable')
    expect(store.isLoading).toBe(false)
    // Blanking the list on a transient error would make the UI look empty
    // rather than broken, which is a worse lie than showing stale data.
    expect(store.tasks).toEqual([task])
  })

  it('replaces the task in place when completion changes, without refetching the list', async () => {
    const task = makeTask({ completed: false })
    api.listTasks.mockResolvedValue([task])
    const store = useTaskStore()
    await store.load()
    api.listTasks.mockClear()

    api.setTaskCompletion.mockResolvedValue({ ...task, completed: true })
    await store.setCompletion(task.id, true)

    expect(api.setTaskCompletion).toHaveBeenCalledWith(task.id, true)
    expect(store.tasks[0]?.completed).toBe(true)
    expect(api.listTasks).not.toHaveBeenCalled()
  })

  it('drops a removed task from state', async () => {
    const task = makeTask()
    api.listTasks.mockResolvedValue([task])
    const store = useTaskStore()
    await store.load()

    api.deleteTask.mockResolvedValue(undefined)
    await store.remove(task.id)

    expect(store.tasks).toEqual([])
  })

  it('counts outstanding tasks for the UI', async () => {
    api.listTasks.mockResolvedValue([
      makeTask({ id: 'a', completed: false }),
      makeTask({ id: 'b', completed: true }),
      makeTask({ id: 'c', completed: false }),
    ])
    const store = useTaskStore()
    await store.load()

    expect(store.remainingCount).toBe(2)
  })
})
