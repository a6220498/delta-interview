import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from './App.vue'

describe('App', () => {
  it('mounts the masthead into the layout header landmark rather than the content area', () => {
    // The wiring is the thing under test: the layout exposes two insertion
    // points and the masthead has to take the header one, or the page ships
    // its title inside <main> and the landmark it left behind is empty.
    const wrapper = mount(App)

    expect(wrapper.get('header').text()).toContain('任務管理應用程式')
    expect(wrapper.get('main').text()).not.toContain('任務管理應用程式')
  })
})
