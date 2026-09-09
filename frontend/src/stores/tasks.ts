import { createTask as postTask, getTask, listTasks, updateTask as putTask } from '@/api/tasks'
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
   *
   * Rows, not whole tasks: the contract's list endpoint answers without
   * `description`, and the type says so, so nothing downstream can read a
   * detail the board never received. {@link fetchTask} is where the whole task
   * comes from.
   */
  const taskList = ref<TaskSummary[]>([])

  /**
   * Whether a load is currently in flight.
   *
   * The board needs this to tell "nothing on the shelf" apart from "not back
   * yet": both are an empty `taskList`, and only one of them should say 架上沒有單子.
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
   * would have to wrap. A failed load also leaves the previous {@link taskList} in
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
   * Fetches one whole task — detail included — from `GET /api/tasks/{id}`.
   *
   * The board's rows deliberately carry no `description`, so the sheet that
   * edits a task asks for the one docket it is about. Without this the sheet
   * would open on an empty 說明 and save that emptiness over detail its reader
   * was never shown.
   *
   * A failure is reported by handing back nothing rather than by throwing —
   * the same bargain {@link fetchTasks} makes, so the caller opens the sheet
   * behind an `if` and needs no catch. The reason still lands in {@link error},
   * because a 編輯 that quietly does nothing cannot be told apart from a broken
   * button.
   *
   * Deliberately leaves {@link taskList} and {@link loading} alone. `loading` is
   * the board's own flag — it is what puts 載入中 in both trays — and one
   * docket being fetched is not the shelves being refetched. A success does not
   * clear {@link error} either: a refresh that failed has still failed, and the
   * notice it put up is about the board rather than about this request.
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
   * Opens a new task through the contract's `POST /api/tasks` and files it.
   *
   * What lands on the shelf is the server's answer, not the values that were
   * typed: the `id`, the `sequence` and both timestamps are the server's to
   * assign — that is the whole reason the sheet does not mint a number — so a
   * row built here would be a guess at four fields until the next refresh.
   *
   * Filed at the front because the contract lists tasks newest first and this
   * one is the newest there is. Cheaper than refetching the board, which would
   * cost a second round trip to learn what this request just returned.
   *
   * Reports failure by throwing, which is the opposite of {@link fetchTasks}
   * and deliberate. A load nobody asked for has nowhere to be reported but the
   * board; a save was asked for by someone still looking at the sheet they
   * pressed 確定 on, and that sheet — which the caller holds and this store does
   * not — is where the reason belongs. Putting it in {@link error} instead
   * would raise 工單載不出來 over a board that loaded perfectly well, behind a
   * modal that hides it.
   *
   * @param input - The values the sheet collected.
   * @returns The created task, as the server filed it.
   * @throws {ApiError} 400 when the values fail the contract's validation.
   */
  async function createTask(input: CreateTaskRequest): Promise<Task> {
    const created = await postTask(input)

    // The whole task goes in where a row is expected: `Task` is a `TaskSummary`
    // plus its detail, so the extra field is invisible to everything typed
    // against the list, and stripping it would mean keeping a second copy of
    // the contract's field list here just to throw one away.
    taskList.value = [created, ...taskList.value]

    return created
  }

  /**
   * Replaces a task's editable fields through `PUT /api/tasks/{id}`.
   *
   * The stored row is swapped for the server's answer rather than patched field
   * by field, because the response is not always the request: moving a task to
   * the other category re-issues its `sequence` from that category's counter,
   * and the new number is only in what came back.
   *
   * Left where it was in the list. The order is `createdAt` descending and an
   * edit does not change when a task was created; the shelf it hangs on cannot
   * move either, since completion belongs to its own endpoint and is not part
   * of this payload.
   *
   * Throws on failure, for the reason {@link createTask} gives.
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

  return { taskList, loading, error, fetchTasks, fetchTask, createTask, updateTask }
})
