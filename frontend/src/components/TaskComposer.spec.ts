import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TaskComposer from './TaskComposer.vue'

describe('TaskComposer', () => {
  it('emits the trimmed title on submit', async () => {
    const wrapper = mount(TaskComposer)

    await wrapper.get('input[type="text"]').setValue('  Write the contract  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('create')).toEqual([['Write the contract']])
  })

  it('refuses a whitespace-only title instead of letting the backend 400', async () => {
    const wrapper = mount(TaskComposer)

    await wrapper.get('input[type="text"]').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('clears the field after a successful submit so the next task can be typed', async () => {
    const wrapper = mount(TaskComposer)
    const input = wrapper.get<HTMLInputElement>('input[type="text"]')

    await input.setValue('Write the contract')
    await wrapper.get('form').trigger('submit')

    expect(input.element.value).toBe('')
  })

  it('labels the input for screen readers', () => {
    const wrapper = mount(TaskComposer)

    expect(wrapper.get('input[type="text"]').attributes('aria-label')).toBeTruthy()
  })
})
