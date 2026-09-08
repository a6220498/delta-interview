import type { TaskRack } from '@/types/task'

/**
 * Everything that differs between the two racks, in one table.
 *
 * The empty texts are not interchangeable: an empty in-tray should point at the
 * next action, while an empty out-tray is merely a fact and has nothing to
 * suggest.
 */
export const RACKS = {
  open: {
    heading: '未完成',
    hint: 'In Tray',
    tally: 'bg-ink',
    empty: '架上沒有單子 —— 按「新增工單」開一張',
  },
  done: {
    heading: '已完成',
    hint: 'Out Tray',
    tally: 'bg-stamp',
    empty: '還沒有蓋章的單子',
  },
} as const satisfies Record<TaskRack, { heading: string; hint: string; tally: string; empty: string }>
