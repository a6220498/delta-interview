import type { TaskSummary } from '@/types/task'

/**
 * Inputs for the panel that hangs under one docket's three-dot button. There is no
 * `open` prop: the card renders the panel only while the menu is up.
 */
export interface RowMenuProps {
  /**
   * The task the menu was opened from. Its number is printed along the top —
   * the panel opens in the top layer, visually detached from its card.
   */
  task: TaskSummary
  /**
   * The three-dot button the panel hangs from. The element itself, because the
   * panel is positioned by measuring against it and closed by a press on it.
   */
  anchor: HTMLElement
}

/**
 * What the panel reports. Neither entry carries anything out; the panel does take
 * itself away first, since unlike the confirmation nothing here can fail.
 */
export interface RowMenuEmits {
  /** 編輯 was chosen. */
  edit: []
  /** 刪除 was chosen. */
  delete: []
  /**
   * The panel went down. `dismissedByAnchor` says whether the press landed on the
   * three-dot button, which the card cannot work out after the popover dismisses.
   */
  close: [dismissedByAnchor: boolean]
}
