import type { CreateTaskRequest, Task, TaskCategory, UpdateTaskRequest } from '@/types/task'

/**
 * Which of the two jobs the sheet is doing. Named states rather than an `isEdit`
 * boolean, which reads backwards at the call site and cannot grow a third mode.
 */
export type TaskDialogMode = 'create' | 'edit'

/**
 * Putting the sheet on the desk. Two signatures so a mode and the task it needs
 * travel together; calling it on an open sheet re-reads the fields.
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
 * What the sheet hands to whoever holds it. Not a `v-model:open` or an `open`
 * prop: the `<dialog>` element owns whether it is up, so the fact has one owner.
 */
export interface TaskDialogExposed {
  open: TaskDialogOpen
  /** Takes the sheet away; a no-op on a sheet that is already down. */
  close: () => void
}

/**
 * The four fields, as they go onto the wire. Typed as both request bodies at once
 * so a field added to `POST` or `PUT` breaks this component instead of being dropped.
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
 * What the sheet reports. One event, asking nothing of anyone: the sheet files
 * what was typed itself, so there is no `submit` beside it.
 */
export interface TaskDialogEmits {
  /**
   * The sheet went down: 取消, Esc, `close()`, or a save that landed. Reported
   * for whoever wants to know — the sheet is already closed when this fires.
   */
  close: []
}
