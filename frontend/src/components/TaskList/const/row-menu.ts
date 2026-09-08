/** How the panel sits against the three-dot button it hangs from, in pixels. */
export const PLACEMENT = {
  /** Between the bottom of the button and the top of the panel. */
  gap: 4,
  /** The smallest distance kept from any edge of the viewport. */
  margin: 8,
} as const

/**
 * How far the page may scroll before an open panel is taken away, in pixels.
 *
 * A distance rather than a plain "a scroll event arrived": the panel is fixed
 * to the viewport, so it has to go once the card underneath it has moved, but a
 * scroll event already queued when the panel opens would otherwise close it in
 * the same breath as opening it.
 */
export const SCROLL_SLACK = 2
