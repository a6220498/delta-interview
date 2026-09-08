/**
 * The fixed tables and wording `TaskDialog` draws itself from.
 *
 * Plain re-exports rather than the `export type` the sibling `types/` barrel
 * uses: these are runtime values living in a real `.ts` module, so the bundler
 * has something to follow.
 */
export {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  FIELD_LIMITS,
  HEADINGS,
  MESSAGES,
  NEW_NUMBER,
} from './task-dialog'
