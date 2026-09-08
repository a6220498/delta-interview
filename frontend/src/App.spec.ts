import TaskList from '@/components/TaskList/index.vue'
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

  it('hangs both racks in the content area, in-tray before out-tray', () => {
    // The two trays are one component rendered once per row of the rack table,
    // so the table's order is the order a reader meets the shelves in. Asserted
    // against the literal ids rather than against `TASK_RACKS` itself: an
    // expectation read from the same table the loop reads would pass however
    // the table is rewritten.
    const wrapper = mount(App)

    expect(wrapper.findAllComponents(TaskList).map((tray) => tray.props('rack').id)).toEqual([
      'open',
      'done',
    ])
    // Read off the DOM rather than the components, because where the trays are
    // is the other half of the claim: inside <main>, not in the header.
    expect(wrapper.get('main').findAll('[data-hint]').map((hint) => hint.text())).toEqual([
      'In Tray',
      'Out Tray',
    ])
  })

  it('gives each rack only the tasks that belong on it', () => {
    // Vacuously true while the board has no data source, but it is the rule
    // that has to survive the store landing: no task on both shelves, none
    // missing from both.
    const wrapper = mount(App)
    const [open, done] = wrapper.findAllComponents(TaskList)

    expect(open?.props('tasks').every((task) => !task.completed)).toBe(true)
    expect(done?.props('tasks').every((task) => task.completed)).toBe(true)
  })
})
