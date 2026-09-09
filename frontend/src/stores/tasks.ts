import {
  createTask as postTask,
  deleteTask as removeTask,
  getTask,
  listTasks,
  updateTask as putTask,
} from '@/api/tasks'
import type {
  CreateTaskRequest,
  Task,
  TaskFilter,
  TaskSummary,
  UpdateTaskRequest,
} from '@/types/task'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * The board's tasks and the state of the load that produced them. A store rather
 * than a ref in `App.vue`: the sheet, the confirmation and the stamp all write here.
 */
export const useTasksStore = defineStore('tasks', () => {
  /**
   * Every task the last successful load returned, in the server's order. One flat
   * list, not pre-split per rack — `completed` is the only copy of that decision.
   */
  const taskList = ref<TaskSummary[]>([])

  /**
   * Whether a load is currently in flight. Tells "nothing on the shelf" apart from
   * "not back yet" — both are an empty `taskList`.
   */
  const loading = ref(false)

  /**
   * Why the last load failed, or `null` when it did not. A message, not the
   * `ApiError`: the list has no status a caller could usefully branch on.
   */
  const error = ref<string | null>(null)

  /**
   * Loads the task list from `GET /api/tasks` and files it here. Failure is recorded
   * in {@link error} rather than thrown, and leaves the previous {@link taskList} in place.
   *
   * @param filter - Which tasks to fetch; `'all'` sends no query parameter.
   * @returns Resolves once the store reflects the attempt, successful or not.
   */
  async function fetchTasks(filter: TaskFilter = 'all'): Promise<void> {
    loading.value = true
    error.value = null

    try {
      taskList.value = await listTasks(filter)
    } catch (cause) {
      // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
      // backend is not running, which is the likeliest failure in development.
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches one whole task — detail included — from `GET /api/tasks/{id}`, since the
   * board's rows carry no `description`. Returns nothing on failure instead of throwing.
   *
   * @param id - The task to fetch.
   * @returns The whole task, or `null` when it could not be fetched.
   */
  async function fetchTask(id: string): Promise<Task | null> {
    try {
      return await getTask(id)
    } catch (cause) {
      // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
      // backend is not running, which is the likeliest failure in development.
      error.value = cause instanceof Error ? cause.message : String(cause)
      return null
    }
  }

  /**
   * Opens a new task through `POST /api/tasks` and files the server's answer at the
   * front. Throws rather than setting {@link error}: the caller still holds the sheet.
   *
   * @param input - The values the sheet collected.
   * @returns The created task, as the server filed it.
   * @throws {ApiError} 400 when the values fail the contract's validation.
   */
  async function createTask(input: CreateTaskRequest): Promise<Task> {
    const created = await postTask(input)

    // `Task` is a `TaskSummary` plus its detail, so the extra field is invisible
    // to everything typed against the list and stripping it would buy nothing.
    taskList.value = [created, ...taskList.value]

    return created
  }

  /**
   * Replaces a task's editable fields through `PUT /api/tasks/{id}`. The stored row is
   * swapped for the response, which may carry a re-issued `sequence`. Throws on failure.
   *
   * @param id - The task to replace.
   * @param input - The replacement values.
   * @returns The updated task, as the server filed it.
   * @throws {ApiError} 400 on validation failure, 404 when the task is gone.
   */
  async function updateTask(id: string, input: UpdateTaskRequest): Promise<Task> {
    const updated = await putTask(id, input)

    taskList.value = taskList.value.map((filed) => (filed.id === id ? updated : filed))

    return updated
  }

  /**
   * Withdraws a task through `DELETE /api/tasks/{id}` and takes its row off the board.
   * Throws rather than setting {@link error}: the caller still holds the confirmation.
   *
   * @param id - The task to delete.
   * @returns Resolves once the row is off {@link taskList}.
   * @throws {ApiError} 404 when the task was already gone.
   */
  async function deleteTask(id: string): Promise<void> {
    await removeTask(id)

    // The 204 answers with nothing, so the row is dropped here rather than by
    // reloading the board for a list already known but for this one task.
    taskList.value = taskList.value.filter((filed) => filed.id !== id)
  }

  return { taskList, loading, error, fetchTasks, fetchTask, createTask, updateTask, deleteTask }
})
