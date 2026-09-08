import type { TaskCategory } from '@/types/task'

import type { CategoryOption, TaskDialogMode } from '../types'

/** The sheet's own title, one per mode. */
export const HEADINGS: Record<TaskDialogMode, string> = {
  create: '新增工單',
  edit: '編輯工單',
}

/**
 * Stands in for the number while the sheet is still blank.
 *
 * A new task has no number yet — the serial is drawn from the chosen category's
 * counter by the server — so the slot says so rather than sitting empty, which
 * would read as a number that failed to load.
 */
export const NEW_NUMBER = 'NEW'

/**
 * The categories offered, in the order the spec lists them.
 *
 * Only the ordering and the Chinese gloss live here: the `bug` / `feat` prefix
 * each option is drawn with comes from `categoryDisplay()`, the same lookup a
 * card's number uses, so the select and the stub can never name a category
 * differently.
 */
export const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 1, name: '修復' },
  { value: 0, name: '新功能' },
]

/**
 * What a blank sheet starts on.
 *
 * `bug` rather than the lower code, because it is the first option the spec
 * lists and a select that opens on its own first row is what a person expects.
 */
export const DEFAULT_CATEGORY: TaskCategory = 1

/**
 * The contract's own length limits, as `maxlength` on the two text fields.
 *
 * The server validates these regardless; enforcing them in the field as well
 * means a person is stopped at the 200th character rather than at a 400 after
 * they have finished writing.
 */
export const FIELD_LIMITS = { title: 200, description: 2000 } as const

/**
 * Everything the hint rows under the fields can say.
 *
 * One line so far. The other three rows stay empty and keep their height, which
 * is what they are for: a message appearing must not push the rest of the form
 * down and take the reader's place on it along with it.
 */
export const MESSAGES = {
  /** Shown under 標題 when 確定 is pressed with nothing in it. */
  titleRequired: '標題不能空白。',
}
