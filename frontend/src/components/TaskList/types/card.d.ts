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
 * What the docket reports: the row menu's two choices, and nothing else. The mark is
 * not among them — the card files its own stamp, since that is a write it can finish.
 */
export interface CardEmits {
  /**
   * 編輯 was chosen in the row menu. What leaves here is the choice, not a task —
   * the shelf above knows which card it rendered and attaches it there.
   */
  edit: []
  /** 刪除 was chosen in the row menu; the confirmation belongs to the board. */
  delete: []
}
