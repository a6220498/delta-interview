import type { TaskSummary } from '@/types/task'

/**
 * Inputs for the docket that draws one task. A single prop on purpose: every
 * visible difference is derived from the task rather than passed in beside it.
 */
export interface CardProps {
  /** The row to draw; everything a docket shows is on it. */
  task: TaskSummary
}

/**
 * What the docket reports. It renders state and decides nothing: neither event
 * carries a consequence, only the fact that the reader asked for one.
 */
export interface CardEmits {
  /**
   * The completion mark was pressed, carrying the state the card is asking for.
   * The target state rather than a toggle, so two fast clicks cannot race.
   */
  toggle: [completed: boolean]
  /**
   * 編輯 was chosen in the row menu. What leaves here is the choice, not a task —
   * the shelf above knows which card it rendered and attaches it there.
   */
  edit: []
  /** 刪除 was chosen in the row menu; the confirmation belongs to the board. */
  delete: []
}
