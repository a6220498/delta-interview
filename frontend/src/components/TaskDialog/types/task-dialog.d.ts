import type { CreateTaskRequest, Task, TaskCategory, UpdateTaskRequest } from '@/types/task'

/**
 * Which of the two jobs the sheet is doing.
 *
 * Named states rather than an `isEdit` boolean: a boolean names one mode and
 * leaves the other as "not that one", which reads backwards at the call site
 * (`:is-edit="false"` to open a blank sheet) and has nowhere to grow if a third
 * mode ever appears.
 */
export type TaskDialogMode = 'create' | 'edit'

/** What both modes take. */
interface TaskDialogBaseProps {
  /**
   * Whether the sheet is on the desk.
   *
   * Driven from outside rather than held in here, so the screen that owns the
   * board owns when a sheet is open — and the sheet stays mounted while closed,
   * which is what lets the browser hand focus back to the button that opened it.
   */
  open: boolean
}

/** Opening a blank sheet. There is no task yet, so there is nothing to carry in. */
export interface TaskDialogCreateProps extends TaskDialogBaseProps {
  mode: 'create'
  /**
   * Never set in this mode.
   *
   * Spelled out rather than omitted so that handing a task to a blank sheet is
   * a type error at the call site instead of a value the sheet quietly ignores.
   */
  task?: never
}

/** Reopening a filed sheet, with the task it was filed from. */
export interface TaskDialogEditProps extends TaskDialogBaseProps {
  mode: 'edit'
  /**
   * The task being corrected; its current values are what the fields open on.
   *
   * Required by the type rather than checked at runtime: an edit sheet with
   * nothing to edit would draw as a blank one and silently open a second task.
   */
  task: Task
}

/**
 * Inputs for the sheet.
 *
 * A union rather than one shape with an optional task, so the two modes cannot
 * be mixed: `mode` decides which member applies, and the task comes with the
 * mode that needs it.
 */
export type TaskDialogProps = TaskDialogCreateProps | TaskDialogEditProps

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
   * closed has thrown away everything the person typed. Closing is the caller's
   * to do once the write has landed.
   */
  submit: [values: TaskDialogValues]
  /**
   * The sheet was dismissed: 取消, Esc, or the browser closing the dialog.
   *
   * Reported rather than acted on, because `open` belongs to the caller — the
   * sheet closing itself would put the two out of step.
   */
  close: []
}
