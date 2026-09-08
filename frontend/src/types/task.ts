import type { components } from '@/api/generated/schema'

/**
 * Re-exports the contract's task types under stable names.
 *
 * Application code imports from here rather than reaching into
 * `api/generated/`, so the generator's output path stays an implementation
 * detail and a future switch of generator does not touch every call site.
 */
export type Task = components['schemas']['Task']
// [AI assisted 003] 使用 AI 協助補上契約新增的 TaskCategory 型別重新匯出
export type TaskCategory = components['schemas']['TaskCategory']
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type Problem = components['schemas']['Problem']

/** Completion filter for the task list; `'all'` means "send no filter". */
export type TaskFilter = 'all' | 'active' | 'completed'

/**
 * Which shelf a task sits on.
 *
 * A projection of `completed`, not a third state: the board has exactly two
 * racks, and naming them keeps the two trays from being told apart by a raw
 * boolean at every call site.
 */
export type TaskRack = 'open' | 'done'
