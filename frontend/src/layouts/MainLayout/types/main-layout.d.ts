/**
 * Inputs for the page frame's content heading row. Both are optional: the frame
 * draws the board's heading by default, which is the only screen so far.
 */
export interface MainLayoutProps {
  /** Content-area title. Defaults to the board's, the only screen so far. */
  heading?: string
  /**
   * Accessible name and visible label of the primary action button. The `＋`
   * glyph beside it is decoration and stays out of the name.
   */
  actionLabel?: string
}

/** What the frame reports. */
export interface MainLayoutEmits {
  /**
   * The primary action button was pressed. An event rather than a handler prop,
   * so the layout cannot tell what opening a task costs.
   */
  action: []
}
