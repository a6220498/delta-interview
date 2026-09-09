import type { Task, TaskCategory } from '@/types/task'

/**
 * How one category code is drawn on a card. The contract keeps `category` as a
 * bare `0` / `1`; this is the single lookup that turns it into label and prefix.
 */
export interface CategoryDisplay {
  /** Leading segment of the number a person reads, e.g. `bug` in `bug-0012`. */
  prefix: string
  /** Single letter printed inside the stub's category mark. */
  mark: string
  /** Whether the mark is filled rather than outlined; category is told apart by fill, not colour. */
  solid: boolean
}

/** Prefix and fill per category code; `mark` is derived so it cannot drift from `prefix`. */
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
 * Builds the number a person reads off a task, e.g. `bug-0012`. Composed from
 * (`category`, `sequence`) at render time rather than stored, so it never goes stale.
 *
 * @param task - Any object carrying the task's category and serial.
 * @returns The display number, e.g. `feat-0004`.
 */
export function displayNumber(task: Pick<Task, 'category' | 'sequence'>): string {
  return `${CATEGORY_DISPLAY[task.category].prefix}-${String(task.sequence).padStart(4, '0')}`
}

/**
 * Renders a due date the way a board shows it: month and day only, the year
 * being noise on near-term work.
 *
 * @param dueDate - The contract's ISO date, or `null` when there is no deadline.
 * @returns `MM/DD`, or `無期限` when there is no deadline.
 */
export function formatDueDate(dueDate: string | null | undefined): string {
  return dueDate ? dueDate.slice(5).replace('-', '/') : '無期限'
}

/**
 * Today's date on the user's own calendar, as `YYYY-MM-DD`. Assembled from local
 * parts, not `toISOString()`, which is UTC and reads a day behind east of Greenwich.
 *
 * @returns The local calendar date in the same shape the contract uses.
 */
function localToday(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Whether a task's deadline has passed without it being finished. Due *today* is
 * not overdue, and a completed task never is however late it was finished.
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
