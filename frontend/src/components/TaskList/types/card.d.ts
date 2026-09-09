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
 * What the docket reports: the row menu's two choices and a request to read it. The
 * mark is not among them — the card files its own stamp, a write it can finish alone.
 */
export interface CardEmits {
  /**
   * The card was pressed to be read. The window it opens is the board's, not the
   * card's: one copy on the desk, however many dockets are on the shelves.
   */
  detail: []
  /**
   * 編輯 was chosen in the row menu. What leaves here is the choice, not a task —
   * the shelf above knows which card it rendered and attaches it there.
   */
  edit: []
  /** 刪除 was chosen in the row menu; the confirmation belongs to the board. */
  delete: []
}
