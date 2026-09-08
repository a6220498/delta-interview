import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Header from './index.vue'

describe('Header', () => {
  it('names the application in a level-1 heading, so the document has an outline', () => {
    const wrapper = mount(Header)

    expect(wrapper.get('h1').text()).toBe('任務管理應用程式')
  })

  it('keeps the rule beside the plate out of the accessibility tree', () => {
    // The double rule is a printed-form flourish carrying no information a
    // screen reader could use; announcing it would only pad the header.
    const wrapper = mount(Header)

    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(true)
  })
})
