import type { components } from '@/api/generated/schema'

/** Contract task types under stable names, so call sites never reach into `api/generated/`. */
export type Task = components['schemas']['Task']
/** A task as the list endpoint returns it: everything but `description`. */
export type TaskSummary = components['schemas']['TaskSummary']
// [AI assisted 003] 使用 AI 協助補上契約新增的 TaskCategory 型別重新匯出
export type TaskCategory = components['schemas']['TaskCategory']
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type Problem = components['schemas']['Problem']

/** Completion filter for the task list; `'all'` means "send no filter". */
export type TaskFilter = 'all' | 'active' | 'completed'
