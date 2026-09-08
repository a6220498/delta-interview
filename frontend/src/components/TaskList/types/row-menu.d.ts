import type { Task } from '@/types/task'

/**
 * Inputs for the panel that hangs under one docket's three-dot button.
 *
 * There is no `open` prop and no `open()` to call: the card renders the panel
 * only while the menu is up, so the component's existence is what "open" means.
 * Both props are required for the same reason — a panel that exists is a panel
 * that is already on screen, and it cannot be on screen without knowing which
 * docket it is for or what it is hanging from.
 */
export interface RowMenuProps {
  /**
   * The task the menu was opened from.
   *
   * Its number is printed along the top of the panel: the panel opens in the
   * top layer, visually detached from the card it belongs to, and the number is
   * what ties the two back together before someone presses 刪除.
   */
  task: Task
  /**
   * The three-dot button the panel hangs from.
   *
   * The element itself rather than a selector or an id, because it is used for
   * two things that both need the real box: the panel is positioned by
   * measuring against it, and a press on it is what closes the panel again.
   */
  anchor: HTMLElement
}

/**
 * What the panel reports.
 *
 * Neither entry carries out anything — 編輯 opens the sheet next door and 刪除
 * asks a question, and both of those belong to the screen above. What the panel
 * does do before reporting is take itself away: unlike the confirmation, which
 * has to survive a failed delete, nothing here can fail.
 */
export interface RowMenuEmits {
  /** 編輯 was chosen. */
  edit: []
  /** 刪除 was chosen. */
  delete: []
  /**
   * The panel went down: an entry was chosen, the page scrolled, the window was
   * resized, Esc was pressed, or a press landed outside it.
   *
   * `dismissedByAnchor` says whether that press landed on the three-dot button
   * itself. It travels with the event because the card cannot work it out
   * afterwards: the browser dismisses a popover on `pointerdown`, before the
   * `click` that would put it straight back up, so by the time the card's own
   * click handler runs the panel is already gone and the press looks exactly
   * like the one that opened it. Carrying the answer out here is what lets the
   * three-dot button behave as a switch rather than as a button that reopens
   * what it just closed.
   */
  close: [dismissedByAnchor: boolean]
}
