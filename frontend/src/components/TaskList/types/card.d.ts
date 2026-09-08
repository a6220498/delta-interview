import type { Task } from '@/types/task'

/**
 * Inputs for the docket that draws one task.
 *
 * A single prop on purpose: every visible difference on the card — the number,
 * the stub's colours, the strike-through, the stamp, the overdue tag — is
 * derived from the task rather than passed in beside it, so a caller cannot
 * hand the card a state that disagrees with the data it is drawing.
 */
export interface CardProps {
  /** The task to draw. */
  task: Task
}

/**
 * What the docket reports. It renders state and decides nothing: neither event
 * carries a consequence, only the fact that the reader asked for one.
 */
export interface CardEmits {
  /**
   * The completion mark was pressed, carrying the state the card is asking for.
   *
   * The target state rather than a bare "toggle", matching the contract's
   * completion endpoint: a toggle derives the new state from whatever is
   * current, so two fast clicks race to an unpredictable result.
   */
  toggle: [completed: boolean]
  /**
   * 編輯 was chosen in the row menu.
   *
   * The card opens the menu but carries out neither of its entries: editing
   * means the form sheet, which is one for the whole board rather than one per
   * docket. What leaves here is the choice, not a task — the shelf above knows
   * which card it rendered and attaches it there.
   */
  edit: []
  /**
   * 刪除 was chosen in the row menu.
   *
   * Reported the same way and for the same reason: what a delete costs is not
   * the card's to know, and the confirmation that asks about it belongs to the
   * board.
   */
  delete: []
}
