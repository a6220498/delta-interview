import type { TaskRack } from '@/const/task'
import type { TaskSummary } from '@/types/task'

/**
 * Inputs for one shelf of the board. The tray does no filtering of its own —
 * making that decision once per mounted tray is how a task lands on both shelves.
 */
export interface TaskListProps {
  /**
   * The shelf this tray is. The row itself rather than an id to look up, so the
   * tray needs no copy of the board's table.
   */
  rack: TaskRack
  /**
   * The tasks to stack, already selected for this rack by the caller. Rows, not
   * whole tasks: the list endpoint answers without `description`.
   */
  tasks: TaskSummary[]
  /**
   * Whether the board is still fetching. An empty shelf and a shelf that has not
   * arrived are the same `tasks`, and only the caller knows which it is handing over.
   */
  loading?: boolean
}

/**
 * What the shelf reports: its cards' events, each with the task it came from. The
 * list is the last place that knows which card is which.
 */
export interface TaskListEmits {
  /** A card asked to change completion state, carrying the task it belongs to. */
  toggle: [task: TaskSummary, completed: boolean]
  /** A card's 編輯 was chosen, carrying the task it belongs to. */
  edit: [task: TaskSummary]
  /** A card's 刪除 was chosen, carrying the task it belongs to. */
  delete: [task: TaskSummary]
}
