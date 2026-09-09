import { useTaskDrag } from '@/composables/useTaskDrag'
import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import type { Task, TaskSummary } from '@/types/task'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Card from './Card.vue'
import { SKELETON_CARDS } from './const'
import TaskList from './index.vue'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  // Stacking a shelf mounts cards, and a card reaches for the store to file its own
  // stamp. Nothing here presses the mark, so an empty board of its own is enough.
  setActivePinia(createPinia())

  // The tray files the stamp a dropped docket asks for, so it needs a server to
  // answer; the tests that care what came back say so.
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(200, stamped()))
})

afterEach(() => {
  // The drag gesture is module state, so a docket left in hand by one test would
  // still be in hand in the next one.
  useTaskDrag().release()
})

/** Builds a `fetch` Response double with the given status and JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Builds the whole task the completion endpoint answers with: the row plus its detail. */
function stamped(overrides: Partial<Task> = {}): Task {
  return { ...task(), description: null, completed: true, ...overrides }
}

/** Returns the options passed to the most recent `fetch` call. */
function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {}
}

/**
 * Builds one of the rows the board hands down. A `TaskSummary`, not a `Task`: the
 * shelf is drawn from what `GET /api/tasks` returns, which carries no description.
 */
function task(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: '3f1a7c2e-9b04-4f5d-8a11-6c2d5e0f7b31',
    category: 1,
    sequence: 12,
    title: '補上 CORS 設定',
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
 * The rack filed under `id`, taken from the table the board itself hangs. A fixture
 * row would let the tray and the real table drift while these tests kept passing.
 */
function rack(id: string): TaskRack {
  const row = TASK_RACKS.find((candidate) => candidate.id === id)

  if (!row) {
    throw new Error(`no rack is filed under ${id}`)
  }

  return row
}

/** Mounts an in-tray holding `tasks`. */
function mountList(tasks: TaskSummary[]) {
  return mount(TaskList, { props: { rack: rack('open'), tasks } })
}

/**
 * The card the list rendered in position `index`. The explicit failure matters, or
 * `undefined?.vm.$emit(...)` would pass the forwarding assertions on nothing.
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

  describe('while the board is loading', () => {
    it('says the shelf is still coming rather than that it is empty', () => {
      // An empty shelf and one that has not arrived are the same `tasks` prop; only
      // this flag tells them apart, and 新增工單 offered too early invites a duplicate.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [], loading: true } })

      expect(wrapper.text()).toContain('載入中')
      expect(wrapper.text()).not.toContain('架上沒有單子')
    })

    it('marks the tray busy, so the notice is announced as a wait and not as a fact', () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [], loading: true } })

      expect(wrapper.get('[data-tray]').attributes('aria-busy')).toBe('true')
    })

    it('leaves the cards it already has in place while a refresh runs', () => {
      // A refresh is not a first load: swapping loaded dockets for a notice
      // would blank the board every time anything on it is saved.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three, loading: true } })

      expect(wrapper.findAllComponents(Card)).toHaveLength(3)
      expect(wrapper.text()).not.toContain('載入中')
    })

    it('leaves the tray unmarked once the load is done', () => {
      const wrapper = mountList([])

      expect(wrapper.get('[data-tray]').attributes('aria-busy')).toBeUndefined()
    })

    it('draws a stack of docket-shaped placeholders rather than a spinner', () => {
      // The whole point of the placeholders is that the stack already has its shape:
      // a spinner occupies one line, so every card would shove the tray on arrival.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [], loading: true } })

      expect(wrapper.findAll('[data-skeleton]')).toHaveLength(SKELETON_CARDS)
    })

    it('keeps the placeholders out of the accessibility tree', () => {
      // They hold no task and no control, so a shelf of them would be read out as
      // several blank cards; the notice beside them is what carries the wait.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [], loading: true } })

      expect(wrapper.get('[data-skeleton]').attributes('aria-hidden')).toBe('true')
    })

    it('takes the placeholders down once the shelf has arrived', () => {
      const wrapper = mountList(three)

      expect(wrapper.findAll('[data-skeleton]')).toHaveLength(0)
    })

    it('draws no placeholders over cards a refresh is about to replace', () => {
      // Same reasoning as the notice: a refresh is not a first load, and covering
      // dockets that are still readable with placeholders loses what they said.
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: three, loading: true } })

      expect(wrapper.findAll('[data-skeleton]')).toHaveLength(0)
    })
  })

  describe('forwarding', () => {
    it('passes an edit request up with the task it belongs to', async () => {
      // Deliberately not the first card: the list must attach the task the
      // event actually came from, not whichever one it rendered first.
      const wrapper = mountList(three)

      await cardAt(wrapper, 2).vm.$emit('edit')

      expect(wrapper.emitted('edit')).toEqual([[skeleton]])
    })

    it('passes a delete request up with the task it belongs to', async () => {
      const wrapper = mountList(three)

      await cardAt(wrapper, 0).vm.$emit('delete')

      expect(wrapper.emitted('delete')).toEqual([[cors]])
    })

    it('passes a request to read a docket up with the task it belongs to', async () => {
      const wrapper = mountList(three)

      await cardAt(wrapper, 1).vm.$emit('detail')

      expect(wrapper.emitted('detail')).toEqual([[readme]])
    })
  })

  describe('拖曳換架', () => {
    /**
     * Drags a docket over the tray `wrapper` is showing, and reports whether the tray
     * took it: a drop target is exactly an element that cancels `dragover`.
     */
    function dragOver(wrapper: ReturnType<typeof mountList>): boolean {
      const event = new Event('dragover', { bubbles: true, cancelable: true })

      wrapper.get('[data-tray]').element.dispatchEvent(event)

      return event.defaultPrevented
    }

    it('offers itself as a shelf for a docket that belongs on the other one', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)

      expect(dragOver(wrapper)).toBe(true)

      await nextTick()

      expect(wrapper.get('[data-tray]').attributes('data-over')).toBe('true')
    })

    it('turns down a docket it already holds, which is no move at all', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)

      expect(dragOver(wrapper)).toBe(false)

      await nextTick()

      expect(wrapper.get('[data-tray]').attributes('data-over')).toBeUndefined()
    })

    it('is not a drop target while nothing is being dragged at all', () => {
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      expect(dragOver(wrapper)).toBe(false)
    })

    it('stops offering itself once the docket is carried back out', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)
      dragOver(wrapper)

      // relatedTarget is where the pointer went; outside the tray, so it has left.
      await wrapper.get('[data-tray]').trigger('dragleave', { relatedTarget: document.body })

      expect(wrapper.get('[data-tray]').attributes('data-over')).toBeUndefined()
    })

    it('keeps the offer up while the pointer crosses a card inside it', async () => {
      // dragleave fires on every boundary inside the tray too; taking the offer
      // down there would make it flicker across a shelf that has cards on it.
      const wrapper = mount(TaskList, {
        props: { rack: rack('done'), tasks: three },
        attachTo: document.body,
      })

      useTaskDrag().lift(task({ completed: false }), null)
      dragOver(wrapper)
      await nextTick()

      await wrapper
        .get('[data-tray]')
        .trigger('dragleave', { relatedTarget: wrapper.get('article').element })

      expect(wrapper.get('[data-tray]').attributes('data-over')).toBe('true')

      wrapper.unmount()
    })

    it('files the state of the shelf it was dropped on, not a toggle', async () => {
      // The same endpoint the mark presses: dropping a docket here says where it
      // now belongs, which is what the tray already knows about itself.
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ id: 'a', completed: false }), null)

      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe('/api/tasks/a/completion')
      expect(JSON.parse(String(lastInit().body))).toEqual({ completed: true })
    })

    it('sends nothing when a docket is dropped back on the shelf it came from', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('open'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)

      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends nothing when the tray is dropped on with empty hands', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('lets go of the docket as it lands, so no tray stays lit afterwards', async () => {
      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)

      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      expect(useTaskDrag().dragged.value).toBeNull()
      expect(wrapper.get('[data-tray]').attributes('data-over')).toBeUndefined()
    })

    it('says on the shelf why a docket dropped here did not make it', async () => {
      // The docket stays where it was, so the tray it was aimed at is the only
      // place that can say the drop was refused.
      fetchMock.mockResolvedValue(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )

      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ completed: false }), null)

      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      const notice = wrapper.get('[data-drop-error]')

      expect(notice.text()).toContain('狀態沒改到')
      expect(notice.text()).toContain('這張單子已經不在了。')
      expect(notice.attributes('role')).toBe('alert')
    })

    it('clears the refusal once a later drop lands', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(404, { status: 404, title: 'Not Found', detail: '這張單子已經不在了。' }),
      )

      const wrapper = mount(TaskList, { props: { rack: rack('done'), tasks: [] } })

      useTaskDrag().lift(task({ id: 'a', completed: false }), null)
      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      useTaskDrag().lift(task({ id: 'b', completed: false }), null)
      await wrapper.get('[data-tray]').trigger('drop')
      await flushPromises()

      expect(wrapper.find('[data-drop-error]').exists()).toBe(false)
    })
  })
})
