import type { TaskSummary } from '@/types/task'

/**
 * What the second copy hands to whoever holds it. The same arrangement as
 * `TaskDialogExposed`: the `<dialog>` owns whether it is up, so no prop may.
 */
export interface CardDetailDialogExposed {
  /**
   * Pulls one docket off the shelf and reads it. The row draws the whole sheet but its
   * 說明, fetched here rather than by the caller, so only that one block ever waits.
   *
   * @param task - The row whose card was pressed.
   */
  open: (task: TaskSummary) => void
  /** Files the copy back; a no-op on a sheet that is already down. */
  close: () => void
}

/**
 * What the second copy reports. One event, asking nothing of anyone: there is
 * nothing on this sheet to confirm, so nothing is left over for an owner to act on.
 */
export interface CardDetailDialogEmits {
  /** The sheet went down: 關閉, Esc, or `close()`. Reading it changes nothing. */
  close: []
}
