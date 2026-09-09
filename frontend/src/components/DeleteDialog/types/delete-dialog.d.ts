import type { Task } from '@/types/task'

/**
 * What the confirmation hands to whoever holds it. Same arrangement as
 * `TaskDialogExposed`: the `<dialog>` owns whether it is up, so a prop must not.
 */
export interface DeleteDialogExposed {
  /**
   * Puts the question on the desk, about one particular docket. The task is
   * required — a confirmation that cannot name what it is about is not worth asking.
   *
   * @param task - The task the caller is proposing to delete.
   */
  open: (task: Task) => void
  /** Takes the question away, answered or not; a no-op on a sheet already down. */
  close: () => void
}

/**
 * What the confirmation reports. It asks a question and carries out neither
 * answer: deleting is the owner's, and so is closing.
 */
export interface DeleteDialogEmits {
  /**
   * 確定 was pressed, carrying the task the sheet was opened on. The sheet does not
   * close itself — a delete can fail, and the question must survive that.
   */
  confirm: [task: Task]
  /**
   * The sheet went down: 取消, Esc, or `close()`. None of them is an answer; Esc
   * is deliberately equivalent to 取消.
   */
  close: []
}
