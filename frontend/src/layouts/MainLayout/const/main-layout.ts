/**
 * What the frame titles and labels itself with when the caller says nothing.
 * `withDefaults` type-checks it, so a renamed prop fails here instead of silently.
 */
export const MAIN_LAYOUT_DEFAULTS = {
  heading: '看板 / Board',
  actionLabel: '新增工單',
} as const
