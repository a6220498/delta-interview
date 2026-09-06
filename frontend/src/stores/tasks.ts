import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/api/http'
import * as api from '@/api/tasks'
import type { CreateTaskRequest, Task, TaskFilter, UpdateTaskRequest } from '@/types/task'

/**
 * Owns the task list, its filter, and the loading/error state around it.
 *
 * Mutations report failures through `error` rather than rejecting. Every caller
 * is a template event handler, and an unhandled rejection there would surface
 * as a console error the user never sees — the store is the one place that can
 * turn a failure into something renderable.
 */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const filter = ref<TaskFilter>('all')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /** How many tasks are still outstanding under the current filter. */
  const remainingCount = computed(() => tasks.value.filter((task) => !task.completed).length)

  /**
   * Reloads the task list for the current filter.
   *
   * On failure the previously loaded tasks are kept: blanking the list would
   * make a transient outage look like "you have no tasks", which is a worse
   * lie than showing slightly stale data next to an error message.
   *
   * @returns resolves once `tasks` reflects the backend, or `error` explains why not.
   */
  async function load(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      tasks.value = await api.listTasks(filter.value)
    } catch (cause) {
      error.value = describe(cause)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Switches the completion filter and refetches from the backend.
   *
   * @param next - the filter to apply.
   * @returns resolves once the newly filtered list has loaded.
   */
  async function setFilter(next: TaskFilter): Promise<void> {
    filter.value = next
    await load()
  }

  /**
   * Creates a task and reloads so the new task lands in the current filter's
   * ordering rather than being guessed into place.
   *
   * @param input - the title and optional description.
   * @returns resolves once the list reflects the creation.
   */
  async function add(input: CreateTaskRequest): Promise<void> {
    await mutate(async () => {
      await api.createTask(input)
      await load()
    })
  }

  /**
   * Replaces a task's editable fields, leaving completion state untouched.
   *
   * @param id - the task to edit.
   * @param input - the replacement title and description.
   * @returns resolves once the task in state matches the backend.
   */
  async function edit(id: string, input: UpdateTaskRequest): Promise<void> {
    await mutate(async () => replace(await api.updateTask(id, input)))
  }

  /**
   * Sets a task's completion state to an explicit value.
   *
   * Patches the returned task into place instead of refetching: the backend has
   * already told us the task's new state, and a reload would drop the user's
   * scroll position for no new information.
   *
   * @param id - the task to change.
   * @param completed - the desired state; idempotent, so a double click is safe.
   * @returns resolves once the task in state reflects the new value.
   */
  async function setCompletion(id: string, completed: boolean): Promise<void> {
    await mutate(async () => replace(await api.setTaskCompletion(id, completed)))
  }

  /**
   * Deletes a task and drops it from state.
   *
   * @param id - the task to delete.
   * @returns resolves once the task is gone from `tasks`.
   */
  async function remove(id: string): Promise<void> {
    await mutate(async () => {
      await api.deleteTask(id)
      tasks.value = tasks.value.filter((task) => task.id !== id)
    })
  }

  /**
   * Runs a mutation, routing any failure into `error`.
   *
   * @param operation - the mutation to perform.
   * @returns resolves once the operation settles, successfully or not.
   */
  async function mutate(operation: () => Promise<void>): Promise<void> {
    error.value = null
    try {
      await operation()
    } catch (cause) {
      error.value = describe(cause)
    }
  }

  /**
   * Swaps an updated task into the list in place.
   *
   * @param updated - the task as the backend now holds it.
   */
  function replace(updated: Task): void {
    const index = tasks.value.findIndex((task) => task.id === updated.id)
    if (index !== -1) {
      tasks.value[index] = updated
    }
  }

  return { tasks, filter, isLoading, error, remainingCount, load, setFilter, add, edit, setCompletion, remove }
})

/**
 * Renders any thrown value as a message worth showing a user.
 *
 * @param cause - whatever was thrown; `unknown` because JS can throw anything.
 * @returns the backend's explanation when there is one, else a generic fallback.
 */
function describe(cause: unknown): string {
  if (cause instanceof ApiError) {
    return `${cause.message}（HTTP ${cause.status}）`
  }
  return cause instanceof Error ? cause.message : '發生未預期的錯誤。'
}
