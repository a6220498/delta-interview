/**
 * How many placeholders a waiting shelf draws. A fixed count, since the number of
 * dockets coming is exactly what the shelf does not know yet: enough to read as a
 * stack rather than one stranded card, few enough not to promise a full shelf.
 */
export const SKELETON_CARDS = 3

/** What the shelf says while it waits, for readers the placeholders say nothing to. */
export const LOADING_NOTICE = '載入中 —— 正在取回架上的單子'
