/**
 * The fixed tables `TaskList` draws itself from.
 *
 * Plain re-exports rather than the `export type` the sibling `types/` barrel
 * uses: these are runtime values living in real `.ts` modules, so the bundler
 * has something to follow.
 *
 * What differs between the two racks used to live here too; it is now one row
 * of `@/const/task`, handed to the tray as a prop, because the board has to
 * loop over the same table to know which trays to hang.
 */
export { LABELS } from './card'
