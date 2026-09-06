import type { components } from '@/api/generated/schema'

/**
 * Re-exports the contract's task types under stable names.
 *
 * Application code imports from here rather than reaching into
 * `api/generated/`, so the generator's output path stays an implementation
 * detail and a future switch of generator does not touch every call site.
 */
export type Task = components['schemas']['Task']
export type CreateTaskRequest = components['schemas']['CreateTaskRequest']
export type UpdateTaskRequest = components['schemas']['UpdateTaskRequest']
export type Problem = components['schemas']['Problem']

/** Completion filter for the task list; `'all'` means "send no filter". */
export type TaskFilter = 'all' | 'active' | 'completed'
