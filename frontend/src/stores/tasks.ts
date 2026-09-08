import { listTasks } from '@/api/tasks'
import type { Task, TaskFilter } from '@/types/task'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * The board's tasks, and everything the screen needs to know about the load
 * that produced them.
 *
 * A store rather than a ref inside `App.vue`, because the list is not the
 * board's private business: the sheet, the confirmation and the completion
 * stamp all write to the same tasks, and passing one array plus a handful of
 * mutators down through the trays is how two components end up disagreeing
 * about what is on the shelf.
 *
 * A setup store rather than the options form, to match the rest of the
 * codebase's `<script setup>` idiom — refs and functions, no `this`.
 */
export const useTasksStore = defineStore('tasks', () => {
  /**
   * Every task the last successful load returned, in the server's order.
   *
   * Held as one flat list rather than pre-split per rack: which shelf a task
   * belongs on is `completed`, and a second copy of that decision is how a task
   * lands on both shelves or on neither.
   */
  const tasks = ref<Task[]>([])

  /**
   * Whether a load is currently in flight.
   *
   * The board needs this to tell "nothing on the shelf" apart from "not back
   * yet": both are an empty `tasks`, and only one of them should say 架上沒有單子.
   */
  const loading = ref(false)

  /**
   * Why the last load failed, or `null` when it did not.
   *
   * A message rather than the `ApiError` itself: the list has no status a
   * caller could usefully branch on — a 404 is not a normal outcome for a
   * collection — so what is left is the sentence to put on screen. Phrasing
   * what to do about it stays with the view, which is the half that knows there
   * is a 重試 button next to it.
   */
  const error = ref<string | null>(null)

  /**
   * Loads the task list from the contract's `GET /api/tasks` and files it here.
   *
   * The filter travels to the server as the contract's `completed` parameter
   * rather than being applied to the result, so a large task set never crosses
   * the wire just to be discarded in the browser.
   *
   * Failures are recorded in {@link error} instead of being re-thrown: a load
   * that fails is a state the board draws, not an exception every call site
   * would have to wrap. A failed load also leaves the previous {@link tasks} in
   * place — "we could not check" is not "the tasks are gone", and blanking the
   * board would hide work the server still holds.
   *
   * @param filter - Which tasks to fetch; `'all'` sends no query parameter.
   * @returns Resolves once the store reflects the attempt, successful or not.
   */
  async function fetchTasks(filter: TaskFilter = 'all'): Promise<void> {
    loading.value = true
    error.value = null

    try {
      tasks.value = await listTasks(filter)
    } catch (cause) {
      // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
      // backend is not running, which is the likeliest failure in development.
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      loading.value = false
    }
  }

  return { tasks, loading, error, fetchTasks }
})
