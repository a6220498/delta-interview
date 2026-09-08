import type { CreateTaskRequest, Task, TaskCategory, UpdateTaskRequest } from '@/types/task'

/**
 * Which of the two jobs the sheet is doing.
 *
 * Named states rather than an `isEdit` boolean: a boolean names one mode and
 * leaves the other as "not that one", which reads backwards at the call site
 * (`open(false)` to open a blank sheet) and has nowhere to grow if a third mode
 * ever appears.
 */
export type TaskDialogMode = 'create' | 'edit'

/**
 * Putting the sheet on the desk.
 *
 * Two signatures rather than one with an optional task, so a mode and the task
 * it needs travel together: `open('edit', …)` cannot be called without one, and
 * `open('create')` cannot be handed one. That pairing is the whole reason this
 * is typed as an overload — checked where the sheet is opened, it costs the
 * sheet no runtime guard and cannot be got wrong at all.
 *
 * Calling it on a sheet that is already open is legitimate: it re-reads the
 * fields from what it is handed, so the same sheet can be moved onto another
 * task without being closed first.
 */
export interface TaskDialogOpen {
  /** Opens a blank sheet. There is no task yet, so there is nothing to carry in. */
  (mode: 'create'): void
  /**
   * Opens the sheet on a filed task, with its stored values in the fields.
   *
   * @param task - The task being corrected; its current values are what the
   *   fields open on.
   */
  (mode: 'edit', task: Task): void
}

/**
 * What the sheet hands to whoever holds it.
 *
 * The sheet owns whether it is open, and this is how that is asked for. It is
 * deliberately not a `v-model:open` or an `open` prop: a dialog opened by a
 * prop and closed by the browser — Esc, the backdrop — has two owners for one
 * fact, and they go out of step the first time the browser wins. Here the
 * question "is the sheet up?" has exactly one answer, and it is the `<dialog>`
 * element's own.
 */
export interface TaskDialogExposed {
  open: TaskDialogOpen
  /**
   * Takes the sheet away.
   *
   * A no-op on a sheet that is already down, so the owner can call it after a
   * save without first checking what the person did while it was in flight.
   */
  close: () => void
}

/**
 * What the sheet hands back when it is submitted.
 *
 * Typed as both request bodies at once rather than as a shape of its own: the
 * four fields are the same either way, and stating it against the contract
 * means a field added to `POST` or `PUT` breaks this component instead of being
 * quietly left out of the request the caller builds from it.
 */
export type TaskDialogValues = CreateTaskRequest & UpdateTaskRequest

/** One line of the category select, before its prefix is drawn from the contract. */
export interface CategoryOption {
  /** The contract's category code. */
  value: TaskCategory
  /** What that category is called in the list, e.g. `修復`. */
  name: string
}

/**
 * What the sheet reports. It fills a form and decides nothing: neither event
 * carries out its own consequence.
 */
export interface TaskDialogEmits {
  /**
   * The form passed its own validation, carrying the values as typed.
   *
   * The sheet does not close itself on submit. Saving can fail — a 400 from the
   * contract's validation, a dropped connection — and a sheet that has already
   * closed has thrown away everything the person typed. Closing is the owner's
   * to do, with `close()`, once the write has landed.
   */
  submit: [values: TaskDialogValues]
  /**
   * The sheet went down: 取消, Esc, or `close()`.
   *
   * Reported for whoever wants to know, not asked of anyone — the sheet is
   * already closed by the time this fires, so nothing has to act on it. Every
   * dismissal comes out here, including the owner's own `close()`, because the
   * alternative is a hidden flag deciding which closes are worth mentioning.
   */
  close: []
}
