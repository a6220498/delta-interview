import type { TaskSummary } from '@/types/task'

/**
 * What the confirmation hands to whoever holds it. Same arrangement as
 * `TaskDialogExposed`: the `<dialog>` owns whether it is up, so a prop must not.
 */
export interface DeleteDialogExposed {
  /**
   * Puts the question on the desk, about one particular docket. Required — a
   * confirmation that cannot name what it is about is not worth asking. A row is
   * enough: the sheet shows a number and a title and asks for no detail beyond them.
   *
   * @param task - The task the caller is proposing to delete.
   */
  open: (task: TaskSummary) => void
  /** Takes the question away, answered or not; a no-op on a sheet already down. */
  close: () => void
}

/**
 * What the confirmation reports. One event, and it asks nothing of anyone: the sheet
 * withdraws the docket it names itself, so no answer is left over for an owner to act on.
 */
export interface DeleteDialogEmits {
  /**
   * The sheet went down: 取消, Esc, `close()`, or a delete that landed. Esc is
   * deliberately equivalent to 取消 — an unanswered destructive question does nothing.
   */
  close: []
}
