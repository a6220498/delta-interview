/** The plain functions the app is built out of; the Vue layer takes all of them from here. */
export {
  categoryDisplay,
  displayNumber,
  formatDueDate,
  formatFullDueDate,
  formatTimestamp,
  isOverdue,
} from './task'
export type { CategoryDisplay } from './task'
export { throttle } from './throttle'
