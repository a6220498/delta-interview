import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import type { TaskSummary } from '@/types/task'
import { afterEach, describe, expect, it } from 'vitest'

import { useTaskDrag } from './useTaskDrag'

afterEach(() => {
  // The gesture is module state on purpose, so a docket left in hand by one test
  // would still be in hand in the next one.
  useTaskDrag().release()
})

/** Builds one of the rows a shelf hands to the gesture. */
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

/** The rack filed under `id`, taken from the table the board itself hangs. */
function rack(id: string): TaskRack {
  const row = TASK_RACKS.find((candidate) => candidate.id === id)

  if (!row) {
    throw new Error(`no rack is filed under ${id}`)
  }

  return row
}

/** Builds a `DataTransfer` double: jsdom fires no real drag events for one to arrive on. */
function transfer(): DataTransfer {
  return { effectAllowed: 'none', setData: () => {} } as unknown as DataTransfer
}

describe('useTaskDrag', () => {
  describe('lift', () => {
    it('puts the docket in hand, where the trays can see which one it is', () => {
      const { dragged, lift } = useTaskDrag()

      lift(task({ id: 'a' }), transfer())

      expect(dragged.value?.id).toBe('a')
    })

    it('hands the same gesture to every caller, since a card and a tray are siblings', () => {
      // The card lifts and the tray catches; two refs would leave the tray asking
      // an empty gesture what it is being offered.
      const card = useTaskDrag()
      const tray = useTaskDrag()

      card.lift(task({ id: 'a' }), transfer())

      expect(tray.dragged.value?.id).toBe('a')
    })

    it('marks the drag a move and files the id on it, so the browser starts one at all', () => {
      // Firefox refuses a drag carrying no data; the effect is what gets the
      // pointer the move cursor rather than the "no drop" one.
      const filed: Array<[string, string]> = []
      const dataTransfer = {
        effectAllowed: 'none',
        setData: (format: string, value: string) => filed.push([format, value]),
      } as unknown as DataTransfer

      useTaskDrag().lift(task({ id: 'a' }), dataTransfer)

      expect(dataTransfer.effectAllowed).toBe('move')
      expect(filed).toEqual([['text/plain', 'a']])
    })

    it('still records the docket when the event carries no transfer', () => {
      const { dragged, lift } = useTaskDrag()

      lift(task({ id: 'a' }), null)

      expect(dragged.value?.id).toBe('a')
    })
  })

  describe('accepts', () => {
    it('turns down every shelf while nothing is in hand', () => {
      const { accepts } = useTaskDrag()

      expect(accepts(rack('open'))).toBe(false)
      expect(accepts(rack('done'))).toBe(false)
    })

    it('takes a docket the shelf does not already hold', () => {
      const { accepts, lift } = useTaskDrag()

      lift(task({ completed: false }), transfer())

      expect(accepts(rack('done'))).toBe(true)
    })

    it('turns down the shelf the docket is already on, which is not a move at all', () => {
      const { accepts, lift } = useTaskDrag()

      lift(task({ completed: false }), transfer())

      expect(accepts(rack('open'))).toBe(false)
    })
  })

  describe('release', () => {
    it('ends the gesture, so a dropped docket is no longer offered anywhere', () => {
      const { accepts, dragged, lift, release } = useTaskDrag()

      lift(task({ completed: true }), transfer())
      release()

      expect(dragged.value).toBeNull()
      expect(accepts(rack('open'))).toBe(false)
    })
  })
})
