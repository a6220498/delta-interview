import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import type { Task } from '@/types/task'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Card from './Card.vue'
import TaskList from './index.vue'

/** Builds a task fixture; only the fields this component reads are varied. */
function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
    description: null,
    completed: false,
    dueDate: null,
    createdAt: '2026-09-06T10:00:00Z',
    updatedAt: '2026-09-06T10:00:00Z',
    ...overrides,
  }
}

const cors = task({ id: 'a', sequence: 1 })
const readme = task({ id: 'b', sequence: 2 })
const skeleton = task({ id: 'c', sequence: 3 })
const three = [cors, readme, skeleton]

/**
 * The rack filed under `id`, taken from the table the board itself hangs.
 *
 * Looked up rather than written out here: the tray draws whatever row it is
 * handed, so a fixture row would let the tray and the real table drift while
 * these tests went on passing.
 */
function rack(id: string): TaskRack {
  const row = TASK_RACKS.find((candidate) => candidate.id === id)

  if (!row) {
    throw new Error(`no rack is filed under ${id}`)
  }

  return row
}

/** Mounts an in-tray holding `tasks`. */
function mountList(tasks: Task[]) {
  return mount(TaskList, { props: { rack: rack('open'), tasks } })
}

/**
 * The card the list rendered in position `index`.
 *
 * The explicit failure matters: indexing yields `undefined` for a short render,
 * and `undefined?.vm.$emit(...)` would leave the forwarding assertions below
 * passing against an event that was never sent.
 */
function cardAt(wrapper: ReturnType<typeof mountList>, index: number) {
  const card = wrapper.findAllComponents(Card)[index]

  if (!card) {
    throw new Error(`the list rendered no card in position ${index}`)
  }

  return card
}

describe('TaskList', () => {
  describe('rack head', () => {
    it.each([
      ['open', '未完成'],
      ['done', '已完成'],
    ] as const)('names the %s rack 「%s」 in a level-3 heading', (id, expected) => {
      const wrapper = mount(TaskList, { props: { rack: rack(id), tasks: [] } })

      expect(wrapper.get('h3').text()).toBe(expected)
    })

    it('tallies what is actually on the shelf', () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three } })

      expect(wrapper.get('[data-tally]').text()).toBe('3')
    })

    it('keeps the English tray stamp out of the accessibility tree', () => {
      // "In Tray" is lettering pressed into a physical tray, not a second name
      // for the rack; announcing it would repeat 未完成 in another language.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [] } })

      expect(wrapper.get('[data-hint]').attributes('aria-hidden')).toBe('true')
    })
  })

  describe('stack', () => {
    it('renders one card per task', () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three } })

      expect(wrapper.findAllComponents(Card)).toHaveLength(3)
    })

    it('announces the stack as a list, so its length is known before reading it', () => {
      // Preflight strips list markers, and some browsers drop list semantics
      // along with them; the explicit role puts the item count back.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three } })

      expect(wrapper.get('ul').attributes('role')).toBe('list')
    })
  })

  describe('empty shelf', () => {
    it.each([
      ['open', '架上沒有單子 —— 按「新增工單」開一張'],
      ['done', '還沒有蓋章的單子'],
    ] as const)('points the %s rack at its own next action', (id, expected) => {
      const wrapper = mount(TaskList, { props: { rack: rack(id), tasks: [] } })

      expect(wrapper.text()).toContain(expected)
    })

    it('drops the empty notice as soon as there is something on the shelf', () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three } })

      expect(wrapper.text()).not.toContain('架上沒有單子')
    })
  })

  describe('forwarding', () => {
    it('passes a completion request up with the task it belongs to', async () => {
      // Deliberately not the first card: the list must attach the task the
      // event actually came from, not whichever one it rendered first.
      const wrapper = mountList(three)

      await cardAt(wrapper, 1).vm.$emit('toggle', true)

      expect(wrapper.emitted('toggle')).toEqual([[readme, true]])
    })

    it('passes an edit request up with the task it belongs to', async () => {
      const wrapper = mountList(three)

      await cardAt(wrapper, 2).vm.$emit('edit')

      expect(wrapper.emitted('edit')).toEqual([[skeleton]])
    })

    it('passes a delete request up with the task it belongs to', async () => {
      const wrapper = mountList(three)

      await cardAt(wrapper, 0).vm.$emit('delete')

      expect(wrapper.emitted('delete')).toEqual([[cors]])
    })
  })
})
