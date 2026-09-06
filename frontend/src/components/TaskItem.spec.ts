import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Task } from '@/types/task'

import TaskItem from './TaskItem.vue'

/** Builds a task, letting each test state only the fields it cares about. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    title: 'Write the contract',
    description: null,
    completed: false,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

/** Mounts the component with the given task. */
function mountItem(task: Task) {
  return mount(TaskItem, { props: { task } })
}

describe('TaskItem', () => {
  it('shows the task title and description', () => {
    const wrapper = mountItem(makeTask({ description: 'Cover all five operations' }))

    expect(wrapper.text()).toContain('Write the contract')
    expect(wrapper.text()).toContain('Cover all five operations')
  })

  it('gives the checkbox an accessible name naming the task', () => {
    // A bare checkbox announces only "checkbox" to a screen reader, which is
    // useless in a list of them.
    const wrapper = mountItem(makeTask())

    expect(wrapper.get('input[type="checkbox"]').attributes('aria-label')).toContain('Write the contract')
  })

  it('reflects completion state in the checkbox', () => {
    const wrapper = mountItem(makeTask({ completed: true }))

    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
  })

  it('emits the target state rather than a bare toggle', async () => {
    // The parent forwards this straight to an idempotent PATCH; emitting
    // "toggle" would put the race back that the contract removed.
    const wrapper = mountItem(makeTask({ completed: false }))

    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('setCompleted')).toEqual([[true]])
  })

  it('emits remove from a button that names which task it deletes', async () => {
    const wrapper = mountItem(makeTask())
    const remove = wrapper.get('button[aria-label*="Write the contract"]')

    await remove.trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('keeps a completed task readable instead of hiding it', () => {
    const wrapper = mountItem(makeTask({ completed: true }))

    // Struck-through is fine; dropping the text is not.
    expect(wrapper.text()).toContain('Write the contract')
  })
})
