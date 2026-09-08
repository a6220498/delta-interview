/**
 * One shelf of the board, and everything that differs between shelves.
 *
 * The row carries its own wording, its tally colour and the completion state it
 * holds, so a tray draws itself out of the row it is handed: no component has
 * to know that `open` means 未完成, or that what is stamped turns purple.
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
  /**
   * What the shelf says when nothing is on it.
   *
   * Not interchangeable between racks: an empty in-tray should point at the
   * next action, while an empty out-tray is merely a fact and has nothing to
   * suggest.
   */
  empty: string
  /**
   * The completion state this rack holds.
   *
   * The filing rule, kept with the rack rather than in the board's code: the
   * board matches a task's `completed` against this and needs to know nothing
   * else about which shelf is which.
   */
  completed: boolean
}

// [AI assisted 006] 這張表推翻了前一版的 `TaskRack` const object（enum 風格）。使用者
// 直接給了資料結構，關鍵在 `completed` 這一欄：分架規則進了表裡之後，看板不再認得
// `open` / `done` 這兩個名字，加一個架只要多寫一列。TaskList 元件裡原本那張 `RACKS`
// 對照表因此變成死碼，已一併刪除。
/**
 * The board's racks, in the order they hang.
 *
 * One table, looped over by the board and read by each tray, so a shelf is
 * added by writing a row here and nowhere else. The order is the order they
 * hang in: what is still on someone's desk first, what is already stamped after
 * it.
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
