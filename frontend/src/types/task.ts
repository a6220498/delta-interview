import type { components } from '@/api/generated/schema'

/**
 * Re-exports the contract's task types under stable names.
 *
 * Application code imports from here rather than reaching into
 * `api/generated/`, so the generator's output path stays an implementation
 * detail and a future switch of generator does not touch every call site.
 */
export type Task = components['schemas']['Task']
/**
 * A task as the list endpoint returns it: everything but `description`.
 *
 * Re-exported beside `Task` rather than hidden behind it, because the
 * difference is load-bearing — anything typed against this cannot read a
 * detail the server did not send, which is what stops an edit sheet from
 * saving a blank description over one it never received.
 */
export type TaskSummary = components['schemas']['TaskSummary']
// [AI assisted 003] 使用 AI 協助補上契約新增的 TaskCategory 型別重新匯出
export type TaskCategory = components['schemas']['TaskCategory']
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type Problem = components['schemas']['Problem']

/** Completion filter for the task list; `'all'` means "send no filter". */
export type TaskFilter = 'all' | 'active' | 'completed'
