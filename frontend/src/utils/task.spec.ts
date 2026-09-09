import type { Task } from '@/types/task'
import { describe, expect, it } from 'vitest'

import { categoryDisplay, displayNumber, formatDueDate, isOverdue } from './task'

describe('displayNumber', () => {
  it.each([
    [0, 4, 'feat-0004'],
    [1, 12, 'bug-0012'],
  ] as const)('renders category %i sequence %i as %s', (category, sequence, expected) => {
    expect(displayNumber({ category, sequence })).toBe(expected)
  })

  it('keeps a serial that has outgrown four digits whole', () => {
    // Padding is presentation; it must never become truncation, or two
    // different tasks would print the same number.
    expect(displayNumber({ category: 1, sequence: 12345 })).toBe('bug-12345')
  })
})

describe('categoryDisplay', () => {
  it('gives bug a solid mark and feature a hollow one, so the two differ in shape', () => {
    // The card's colours are already spent on overdue and done; the category
    // is told apart by fill, not by a third colour axis.
    expect(categoryDisplay(1).solid).toBe(true)
    expect(categoryDisplay(0).solid).toBe(false)
  })

  it('takes the mark letter from the prefix, so the two can never disagree', () => {
    expect(categoryDisplay(0)).toMatchObject({ prefix: 'feat', mark: 'F' })
    expect(categoryDisplay(1)).toMatchObject({ prefix: 'bug', mark: 'B' })
  })
})

describe('formatDueDate', () => {
  it('drops the year, which is noise on a board of near-term work', () => {
    expect(formatDueDate('2026-09-07')).toBe('09/07')
  })

  it('says a task has no deadline rather than leaving a blank the eye reads as missing data', () => {
    expect(formatDueDate(null)).toBe('無期限')
  })
})

describe('isOverdue', () => {
  /** Builds the completion/due pair `isOverdue` reads, with the rest of a task omitted. */
  function due(dueDate: string | null, completed = false): Pick<Task, 'dueDate' | 'completed'> {
    return { dueDate, completed }
  }

  it('flags a task whose day has passed', () => {
    expect(isOverdue(due('2026-09-05'), '2026-09-08')).toBe(true)
  })

  it('does not flag a task due today, which still has the whole day to run', () => {
    expect(isOverdue(due('2026-09-08'), '2026-09-08')).toBe(false)
  })

  it('does not flag a task due later', () => {
    expect(isOverdue(due('2026-09-09'), '2026-09-08')).toBe(false)
  })

  it('does not flag a completed task, however late it was finished', () => {
    // Overdue is layered on "open"; once the task is stamped the board has
    // nothing left to chase.
    expect(isOverdue(due('2026-09-05', true), '2026-09-08')).toBe(false)
  })

  it('does not flag a task that was never given a deadline', () => {
    expect(isOverdue(due(null), '2026-09-08')).toBe(false)
  })

  it('compares against the local calendar day, not the UTC one', () => {
    // The default must be the day the *user* is having: `toISOString()` would put
    // anyone east of Greenwich a day behind every morning, un-overdue-ing a task.
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const pad = (value: number) => String(value).padStart(2, '0')
    const localYesterday = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`

    expect(isOverdue(due(localYesterday))).toBe(true)
  })
})
