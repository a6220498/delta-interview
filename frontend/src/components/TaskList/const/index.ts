/**
 * The fixed tables `TaskList` draws itself from.
 *
 * Plain re-exports rather than the `export type` the sibling `types/` barrel
 * uses: these are runtime values living in real `.ts` modules, so the bundler
 * has something to follow.
 */
export { LABELS } from './card'
export { RACKS } from './task-list'
