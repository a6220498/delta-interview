/**
 * How long a button that writes to the server ignores repeat presses, in milliseconds.
 * About the length of a double-click: the second press of one is dropped, while someone
 * coming back a moment later to correct something is never left pressing a dead button.
 *
 * The in-flight guard each of those buttons keeps is a separate thing and stays. This
 * window is blind to how long the request takes; that guard is blind to the clock, and
 * one slower than this window would otherwise be sent twice.
 */
export const WRITE_THROTTLE_MS = 500
