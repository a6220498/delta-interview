/**
 * What the frame titles and labels itself with when the caller says nothing.
 *
 * `withDefaults` type-checks this against `MainLayoutProps`, so a prop renamed
 * in `../types` fails here rather than silently losing its default.
 */
export const MAIN_LAYOUT_DEFAULTS = {
  heading: '看板 / Board',
  actionLabel: '新增工單',
} as const
