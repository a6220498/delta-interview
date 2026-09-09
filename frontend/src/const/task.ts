/**
 * One shelf of the board: its wording, tally colour and the completion state it holds.
 * A tray draws itself from the row it is handed, so no component hard-codes a shelf.
 */
export interface TaskRack {
  /** Stable key for the rack, and what the board keys its trays on. */
  id: string
  /** The rack's name, set as the heading above the tray. */
  title: string
  /** Lettering pressed into the tray itself; decoration, never announced. */
  hint: string
  /** Utility class painting the tally badge behind the count. */
  tally: string
  /** What the shelf says when nothing is on it; not interchangeable between racks. */
  empty: string
  /** The completion state this rack holds; the board matches a task's `completed` against it. */
  completed: boolean
}

// [AI assisted 006] 這張表推翻了前一版的 `TaskRack` const object（enum 風格）。關鍵在
// `completed` 這欄：分架規則進表之後，看板不再認得 `open` / `done` 這兩個名字。
/**
 * The board's racks, in the order they hang: open work first, stamped work after.
 * Adding a shelf means writing a row here and nowhere else.
 */
export const TASK_RACKS: readonly TaskRack[] = [
  {
    id: 'open',
    title: '未完成',
    hint: 'In Tray',
    tally: 'bg-ink',
    empty: '架上沒有單子 —— 按「新增工單」開一張',
    completed: false,
  },
  {
    id: 'done',
    title: '已完成',
    hint: 'Out Tray',
    tally: 'bg-stamp',
    empty: '還沒有蓋章的單子',
    completed: true,
  },
]
