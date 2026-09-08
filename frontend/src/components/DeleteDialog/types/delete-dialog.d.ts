import type { Task } from '@/types/task'

/**
 * What the confirmation hands to whoever holds it.
 *
 * The same arrangement as `TaskDialogExposed`: the sheet owns whether it is up,
 * and this is how that is asked for. A `<dialog>` the browser can close on its
 * own — Esc, and here Esc means "no" — must not also be driven by a prop, or the
 * one fact has two owners and they go out of step the first time the browser
 * wins.
 */
export interface DeleteDialogExposed {
  /**
   * Puts the question on the desk, about one particular docket.
   *
   * The task is required and there is no second signature: what is being
   * confirmed is *this one*, by number and by title, rather than "這個項目" —
   * a confirmation that cannot name what it is about is not worth asking.
   *
   * @param task - The task the caller is proposing to delete.
   */
  open: (task: Task) => void
  /**
   * Takes the question away, answered or not.
   *
   * A no-op on a sheet that is already down, so the owner can call it after a
   * delete without first checking what the person did while it was in flight.
   */
  close: () => void
}

/**
 * What the confirmation reports. It asks a question and carries out neither
 * answer: deleting is the owner's, and so is closing.
 */
export interface DeleteDialogEmits {
  /**
   * 確定 was pressed, carrying the task the sheet was opened on.
   *
   * The task travels with the event rather than being remembered by the owner,
   * for the same reason the sheet owns whether it is up: a second copy of
   * "which one is being deleted" out in the board is a copy that can disagree
   * with the number printed on the paper the person is actually reading.
   *
   * The sheet does not close itself on confirm. A delete can fail — a 404 on a
   * task someone else already removed, a dropped connection — and a sheet that
   * has already gone has taken the question with it. Closing is the owner's to
   * do, with `close()`, once the delete has landed.
   */
  confirm: [task: Task]
  /**
   * The sheet went down: 取消, Esc, or `close()`.
   *
   * Every dismissal comes out here, including the owner's own `close()`, and
   * none of them is an answer — the question is simply no longer being asked.
   * Esc is deliberately equivalent to 取消: an unanswered destructive question
   * defaults to not doing it.
   */
  close: []
}
