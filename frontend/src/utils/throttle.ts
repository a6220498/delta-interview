/**
 * Rate-limits a handler to one run per window, on the leading edge: the first call goes
 * through at once, and every call made inside `wait` after it is dropped rather than
 * queued. Dropped, because the callers are buttons that write to the server — a press
 * held back and replayed a moment later would file the same docket a second time,
 * which is the very thing being guarded against.
 *
 * The window belongs to the returned function, not to `handler`, so each call to
 * `throttle` gets its own: two cards on the same shelf must not share a clock, or
 * stamping one would mute the other.
 *
 * @param handler - What to run. Its return value is dropped, so an `async` one is
 *   fire-and-forget and has to settle its own failures.
 * @param wait - Length of the window in milliseconds, timed from the call that ran.
 *   A call that was dropped does not push the window out.
 * @returns A function taking `handler`'s arguments, which runs it at most once per window.
 */
export function throttle<Args extends unknown[]>(
  handler: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  /** When the last call that was let through started; `-Infinity` while none has. */
  let lastRunAt = Number.NEGATIVE_INFINITY

  return (...args: Args): void => {
    const now = Date.now()

    if (now - lastRunAt < wait) {
      return
    }

    lastRunAt = now
    handler(...args)
  }
}
