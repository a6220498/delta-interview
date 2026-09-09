import type { TaskCategory } from '@/types/task'

import type { CategoryOption, TaskDialogMode } from '../types'

/** The sheet's own title, one per mode. */
export const HEADINGS: Record<TaskDialogMode, string> = {
  create: '新增工單',
  edit: '編輯工單',
}

/**
 * Stands in for the number while the sheet is still blank. The server draws the
 * serial from the chosen category's counter, so an empty slot would read as a failure.
 */
export const NEW_NUMBER = 'NEW'

/**
 * The categories offered, in the order the spec lists them. Only ordering and the
 * Chinese gloss live here; the prefix comes from `categoryDisplay()`.
 */
export const CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 1, name: '修復' },
  { value: 0, name: '新功能' },
]

/** What a blank sheet starts on: the first option the spec lists. */
export const DEFAULT_CATEGORY: TaskCategory = 1

/**
 * The contract's own length limits, as `maxlength` on the two text fields, so a
 * person is stopped at the 200th character rather than at a 400 afterwards.
 */
export const FIELD_LIMITS = { title: 200, description: 2000 } as const

/**
 * Everything the sheet's own message rows can say. The hint rows keep their height
 * when empty, so a message appearing cannot push the rest of the form down.
 */
export const MESSAGES = {
  /** Shown under 標題 when 確定 is pressed with nothing in it. */
  titleRequired: '標題不能空白。',
  /** Heads the notice above the buttons when a save came back refused. */
  saveFailed: '這張單子沒存進去',
}
