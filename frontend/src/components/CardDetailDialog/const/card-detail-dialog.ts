import type { TaskCategory } from '@/types/task'

// [AI assisted 008] 未完成／已完成、修復／新功能都跟 TaskList 與 TaskDialog 各留一份，
// 沒有合併：統一要動到三個既有元件，而這個 codebase 就是每個元件自帶文案常數。
/**
 * Both completion states, as the 狀態 cell prints them. Read-only here: which state a
 * docket is in is the card's mark to change, and this sheet writes nothing.
 */
export const LABELS = { open: '未完成', done: '已完成' } as const

/**
 * What each category is called beside its prefix, so the cell reads `bug — 修復`.
 * The prefix itself comes from `categoryDisplay()`, the same lookup that numbers a card.
 */
export const CATEGORY_NAMES: Record<TaskCategory, string> = { 0: '新功能', 1: '修復' }

/**
 * Everything the 說明 block can say in place of a description. Its status row keeps
 * its element while the text changes, which is what makes the live region announce.
 */
export const MESSAGES = {
  /** The status row while `GET /api/tasks/{id}` is out. */
  loading: '正在取回第二聯…',
  /** Stands in for a docket that genuinely has no description. */
  noDescription: '這張單子沒有寫說明',
  /** Heads the block when the description could not be fetched. */
  failed: '第二聯調不出來',
  /** Says how much of the window is still trustworthy, before the server's own reason. */
  failedScope: '單子其餘欄位是架上那一份，只有說明沒到。',
}
