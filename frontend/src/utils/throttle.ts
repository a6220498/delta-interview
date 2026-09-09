// [AI assisted 011] 選 leading edge + 丟棄，而不是 lodash 那種預設帶 trailing 的節流：
// 這幾顆按鈕會寫進資料庫，補送的第二次等於在使用者早就鬆手之後又開一張單，畫面上沒有
// 任何東西解釋得了它。窗口也刻意從「實際跑的那次」起算 —— 若被丟掉的呼叫也推遲窗口，
// 一直連按的人會把自己鎖在門外，永遠等不到第二次。
/**
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
