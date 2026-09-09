import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LoadFailure from './index.vue'

/** Mounts the notice carrying one reason. */
function mountNotice(reason = '資料庫連線失敗。') {
  return mount(LoadFailure, { props: { reason } })
}

describe('LoadFailure', () => {
  it('names what failed, so the reason is not the whole message', () => {
    // The problem detail says what went wrong on the server, not what the reader
    // lost. Both halves are needed for the notice to mean anything on its own.
    expect(mountNotice().text()).toContain('工單載不出來')
  })

  it("prints the backend's own reason rather than a generic apology", () => {
    // The reason is the actionable half — a 503 and a bad gateway want different
    // things — so it is passed in rather than flattened into one house sentence.
    expect(mountNotice('伺服器回 503。').text()).toContain('伺服器回 503。')
  })

  it('announces itself, because nobody asked for the load that failed', () => {
    // The load runs on its own, so without an announcement a screen-reader user meets
    // an empty board. By selector: in dev the root of the tree is a comment node.
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
    // Not disabled or debounced here: whether a second attempt is worth making is
    // the owner's call, and only the owner knows if the first is still in flight.
    const wrapper = mountNotice()

    await wrapper.get('[data-retry]').trigger('click')
    await wrapper.get('[data-retry]').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(2)
  })

  it('stays quiet until it is pressed', () => {
    expect(mountNotice().emitted('retry')).toBeUndefined()
  })
})
