import type { TaskRack } from '@/const/task'
import type { Task } from '@/types/task'

/**
 * Inputs for one shelf of the board.
 *
 * The tray takes the tasks it should hold and does no filtering of its own:
 * which tasks belong on which shelf is one decision, and making it twice — once
 * per mounted tray — is how a task ends up on both shelves or on neither.
 */
export interface TaskListProps {
  /**
   * The shelf this tray is: its name, its tally colour, its empty text and the
   * completion state it holds.
   *
   * The row itself rather than an id to look up, so the tray needs no copy of
   * the board's table and the two cannot disagree about what a shelf is called.
   */
  rack: TaskRack
  /** The tasks to stack, already selected for this rack by the caller. */
  tasks: Task[]
}

/**
 * What the shelf reports: its cards' events, each with the task it came from.
 *
 * The task is attached here because the list is the last place that knows which
 * card is which; making the screen above work that out from the event's source
 * would tie it to this component's internals.
 */
export interface TaskListEmits {
  /** A card asked to change completion state, carrying the task it belongs to. */
  toggle: [task: Task, completed: boolean]
  /** A card asked for its row menu, carrying the task it belongs to. */
  menu: [task: Task]
}
