import type { CreateTaskRequest, Task, TaskFilter, TaskSummary, UpdateTaskRequest } from '@/types/task'

import { request } from './http'

const TASKS_PATH = '/api/tasks'

/** Maps a UI filter onto the contract's `completed` query parameter. */
const COMPLETED_BY_FILTER: Record<Exclude<TaskFilter, 'all'>, 'true' | 'false'> = {
  active: 'false',
  completed: 'true',
}

/**
 * Fetches the task list, filtered server-side so no discarded task crosses the wire.
 * Rows arrive without `description`; that travels one task at a time via {@link getTask}.
 *
 * @param filter - which tasks to fetch; `'all'` sends no query parameter.
 * @returns the matching tasks, newest first, each without its description.
 * @throws {ApiError} when the backend answers with a non-2xx status.
 */
export function listTasks(filter: TaskFilter = 'all'): Promise<TaskSummary[]> {
  const path = filter === 'all' ? TASKS_PATH : `${TASKS_PATH}?completed=${COMPLETED_BY_FILTER[filter]}`
  return request<TaskSummary[]>(path)
}

/**
 * Fetches a single task, detail included — the only place a `description` comes from.
 *
 * @param id - the task's identifier.
 * @returns the whole task, `description` and all.
 * @throws {ApiError} 404 when no task has that id.
 */
export function getTask(id: string): Promise<Task> {
  return request<Task>(`${TASKS_PATH}/${id}`)
}

/**
 * Creates a task.
 *
 * @param input - title and optional description; the server assigns id,
 *     timestamps and the initial (incomplete) state.
 * @returns the created task.
 * @throws {ApiError} 400 when the title fails the contract's constraints.
 */
export function createTask(input: CreateTaskRequest): Promise<Task> {
  return request<Task>(TASKS_PATH, { method: 'POST', body: JSON.stringify(input) })
}

/**
 * Replaces a task's editable fields. Completion state is not in this payload — it
 * belongs to {@link setTaskCompletion}, so saving an edit cannot reopen a task.
 *
 * @param id - the task to update.
 * @param input - the replacement title and description.
 * @returns the updated task.
 * @throws {ApiError} 400 on validation failure, 404 when the task is gone.
 */
export function updateTask(id: string, input: UpdateTaskRequest): Promise<Task> {
  return request<Task>(`${TASKS_PATH}/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

/**
 * Marks a task complete or incomplete. Takes the target state rather than
 * toggling, so two rapid clicks settle on the same result instead of racing.
 *
 * @param id - the task to change.
 * @param completed - the desired completion state.
 * @returns the task in its new state.
 * @throws {ApiError} 404 when the task is gone.
 */
export function setTaskCompletion(id: string, completed: boolean): Promise<Task> {
  return request<Task>(`${TASKS_PATH}/${id}/completion`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  })
}

/**
 * Deletes a task.
 *
 * @param id - the task to delete.
 * @returns resolves once the backend confirms deletion (204).
 * @throws {ApiError} 404 when the task was already deleted.
 */
export function deleteTask(id: string): Promise<void> {
  return request<void>(`${TASKS_PATH}/${id}`, { method: 'DELETE' })
}
