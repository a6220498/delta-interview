import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LoadFailure from './index.vue'

/** Mounts the notice carrying one reason. */
function mountNotice(reason = '資料庫連線失敗。') {
  return mount(LoadFailure, { props: { reason } })
}

describe('LoadFailure', () => {
  it('names what failed, so the reason is not the whole message', () => {
    // The backend's problem detail says what went wrong on the server; it does
    // not say what the reader lost. Both halves are needed for the notice to
    // mean anything on its own.
    expect(mountNotice().text()).toContain('工單載不出來')
  })

  it("prints the backend's own reason rather than a generic apology", () => {
    // The reason is the actionable half — a 503 and a bad gateway want
    // different things from the reader — so it is passed in rather than
    // flattened into one house sentence.
    expect(mountNotice('伺服器回 503。').text()).toContain('伺服器回 503。')
  })

  it('announces itself, because nobody asked for the load that failed', () => {
    // The load runs on its own at first paint. Without an announcement a
    // screen-reader user meets an empty board with no idea why it is empty.
    // Asked for by selector rather than off `wrapper.element`: the explanatory
    // comment above the notice is a node of its own in dev, so the root of the
    // mounted tree is that comment and not the box.
    expect(mountNotice().get('[role="alert"]').text()).toContain('工單載不出來')
  })

  it('reports 重試 rather than retrying anything itself', async () => {
    // The notice knows a button was pressed; it does not know what the load
    // was, what to send or what to do when the second attempt also fails.
    const wrapper = mountNotice()

    await wrapper.get('[data-retry]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('reports every press, so an impatient second try is not swallowed', async () => {
    // Deliberately not disabled or debounced here: whether a second attempt is
    // worth making is the owner's call, and it is the owner that knows whether
    // the first one is still in flight.
    const wrapper = mountNotice()

    await wrapper.get('[data-retry]').trigger('click')
    await wrapper.get('[data-retry]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(2)
  })

  it('stays quiet until it is pressed', () => {
    expect(mountNotice().emitted('retry')).toBeUndefined()
  })
})
