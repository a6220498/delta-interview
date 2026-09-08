/**
 * Inputs for the notice a screen puts up when it could not fetch its contents.
 *
 * Only the reason is passed in. What failed — 工單載不出來 — is the notice's own
 * wording rather than a prop: one call site cannot disagree with another about
 * what the board is called, and a second notice for a different failure is a
 * second component with its own sentence, not a knob on this one.
 */
export interface LoadFailureProps {
  /**
   * Why the load failed, in the server's own words.
   *
   * Passed in rather than composed here, because the actionable half differs
   * per failure: "後端暫時無法連線" and "資料庫連線失敗" ask different things of
   * the reader, and a single house apology would tell them neither.
   */
  reason: string
}

/**
 * What the notice reports.
 *
 * It asks to try again and carries out nothing: the notice knows a button was
 * pressed, not what the load was, what to send, or what to do when the second
 * attempt fails too.
 */
export interface LoadFailureEmits {
  /**
   * 重試 was pressed.
   *
   * Every press comes out, with no debounce and no disabled state of its own:
   * whether a second attempt is worth making is the owner's call, and only the
   * owner knows whether the first one is still in flight.
   */
  retry: []
}
