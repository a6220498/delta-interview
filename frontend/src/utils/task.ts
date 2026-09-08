import type { Task, TaskCategory } from '@/types/task'

/**
 * How one category code is drawn on a card.
 *
 * The contract keeps `category` as a bare `0` / `1` and says in as many words
 * that the client maps it "to a label and prefix in one lookup at the render
 * boundary" — this is that lookup. Everything a card needs to draw a category
 * comes from here, so no component ever compares `category === 1` on its own.
 */
export interface CategoryDisplay {
  /** Leading segment of the number a person reads, e.g. `bug` in `bug-0012`. */
  prefix: string
  /** Single letter printed inside the stub's category mark. */
  mark: string
  /**
   * Whether the mark is filled rather than outlined.
   *
   * Category is told apart by fill, not colour: the card's colours are already
   * spent on overdue (red) and done (purple), and a third colour axis would
   * compete with the two that carry state.
   */
  solid: boolean
}

/**
 * The prefix and mark shape for each category code.
 *
 * `mark` is derived rather than listed, so a prefix can never drift away from
 * the letter printed on the stub.
 */
const CATEGORY_DISPLAY = {
  0: { prefix: 'feat', solid: false },
  1: { prefix: 'bug', solid: true },
} as const satisfies Record<TaskCategory, Omit<CategoryDisplay, 'mark'>>

/**
 * Resolves a category code into the pieces a card draws it with.
 *
 * @param category - The contract's numeric category code.
 * @returns The prefix, mark letter and fill for that category.
 */
export function categoryDisplay(category: TaskCategory): CategoryDisplay {
  const entry = CATEGORY_DISPLAY[category]

  return { ...entry, mark: entry.prefix.charAt(0).toUpperCase() }
}

/**
 * Builds the number a person reads off a task, e.g. `bug-0012`.
 *
 * Not the task's `id`: `id` is the machine's, never changes and is a uuid. The
 * human number is the pair (`category`, `sequence`), which is why it is
 * composed here at the render boundary rather than stored — moving a task
 * between categories re-issues it, and a stored copy would go stale.
 *
 * Zero-padding stops at four digits but never truncates: a serial past 9999
 * prints in full, because a shortened number would collide with another task's.
 *
 * @param task - Any object carrying the task's category and serial.
 * @returns The display number, e.g. `feat-0004`.
 */
export function displayNumber(task: Pick<Task, 'category' | 'sequence'>): string {
  return `${CATEGORY_DISPLAY[task.category].prefix}-${String(task.sequence).padStart(4, '0')}`
}

/**
 * Renders a due date the way a board shows it: month and day only.
 *
 * The year is dropped because a board carries near-term work, where it is noise
 * on every card. A missing deadline gets words rather than an empty slot — a
 * blank where a date belongs reads as data that failed to load.
 *
 * @param dueDate - The contract's ISO date, or `null` when there is no deadline.
 * @returns `MM/DD`, or `無期限` when there is no deadline.
 */
export function formatDueDate(dueDate: string | null | undefined): string {
  return dueDate ? dueDate.slice(5).replace('-', '/') : '無期限'
}

/**
 * Today's date on the user's own calendar, as `YYYY-MM-DD`.
 *
 * Deliberately assembled from local date parts rather than sliced out of
 * `toISOString()`, which is UTC: for anyone east of Greenwich that string still
 * says "yesterday" through the first hours of every morning, so a task due
 * yesterday would stop being overdue until the clock caught up.
 *
 * @returns The local calendar date in the same shape the contract uses.
 */
function localToday(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Whether a task's deadline has passed without it being finished.
 *
 * Derived here rather than read off the task because the contract deliberately
 * ships no `overdue` flag: a server-computed one goes stale in the browser the
 * moment the date rolls over, whereas this is re-derived on every render.
 *
 * A task due *today* is not overdue — it still has the whole day to run — and a
 * completed task never is, however late it was finished: overdue is a state
 * layered on "open", and the board has nothing left to chase once it is stamped.
 *
 * @param task - Any object carrying the task's deadline and completion state.
 * @param today - Reference date as `YYYY-MM-DD`; defaults to the local today.
 * @returns `true` when the task is open and its day has already passed.
 */
export function isOverdue(
  task: Pick<Task, 'dueDate' | 'completed'>,
  today: string = localToday(),
): boolean {
  return !task.completed && !!task.dueDate && task.dueDate < today
}
