/**
 * Inputs for the notice a screen puts up when it could not fetch its contents.
 * Only the reason is passed in; what failed is the notice's own wording.
 */
export interface LoadFailureProps {
  /**
   * Why the load failed, in the server's own words. Passed in rather than composed
   * here, because the actionable half differs per failure.
   */
  reason: string
}

/**
 * What the notice reports. It asks to try again and carries out nothing — it knows
 * a button was pressed, not what the load was.
 */
export interface LoadFailureEmits {
  /**
   * 重試 was pressed. Every press comes out, with no debounce: whether a second
   * attempt is worth making is the owner's call.
   */
  retry: []
}
