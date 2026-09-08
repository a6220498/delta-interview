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
   * The row menu was requested. The card does not open it: the menu renders in
   * the top layer so it is not clipped by the tray, which makes its placement
   * the board's business rather than the card's.
   */
  menu: []
}
