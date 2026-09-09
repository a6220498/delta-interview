/** How the panel sits against the three-dot button it hangs from, in pixels. */
export const PLACEMENT = {
  /** Between the bottom of the button and the top of the panel. */
  gap: 4,
  /** The smallest distance kept from any edge of the viewport. */
  margin: 8,
} as const

/**
 * How far the page may scroll before an open panel is taken away, in pixels. A
 * distance, not a bare scroll event, which could arrive in the breath after opening.
 */
export const SCROLL_SLACK = 2
