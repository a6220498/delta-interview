import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { throttle } from './throttle'

// The window is read off the clock, so the clock is the one thing every test here
// has to own; a real one would make "inside the window" a matter of how fast the
// machine happened to be.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('throttle', () => {
  it('runs the first call at once, so a button never feels held back', () => {
    const handler = vi.fn()

    throttle(handler, 500)()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('drops a second call made inside the window', () => {
    const handler = vi.fn()
    const throttled = throttle(handler, 500)

    throttled()
    vi.advanceTimersByTime(499)
    throttled()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('drops it rather than queuing it, so it cannot land after the window', () => {
    // A trailing call would file the same docket a second time, a moment after the
    // person had stopped pressing and with nothing on screen to explain it.
    const handler = vi.fn()
    const throttled = throttle(handler, 500)

    throttled()
    throttled()
    vi.advanceTimersByTime(5_000)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('lets a call through once the window has passed', () => {
    const handler = vi.fn()
    const throttled = throttle(handler, 500)

    throttled()
    vi.advanceTimersByTime(500)
    throttled()

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('times the window from the call that ran, not from the one it dropped', () => {
    // Otherwise a person drumming on the button would keep pushing the window out
    // and never get the second press they are asking for.
    const handler = vi.fn()
    const throttled = throttle(handler, 500)

    throttled()
    vi.advanceTimersByTime(400)
    throttled()
    vi.advanceTimersByTime(100)
    throttled()

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('hands the arguments it was called with straight through', () => {
    const handler = vi.fn<(completed: boolean, id: string) => void>()

    throttle(handler, 500)(true, 'bug-0012')

    expect(handler).toHaveBeenCalledWith(true, 'bug-0012')
  })

  it('gives every throttled function its own window', () => {
    // Each card on the shelf throttles its own mark; sharing one window would mean
    // stamping one docket muted the one next to it.
    const handler = vi.fn()
    const first = throttle(handler, 500)
    const second = throttle(handler, 500)

    first()
    second()

    expect(handler).toHaveBeenCalledTimes(2)
  })
})
