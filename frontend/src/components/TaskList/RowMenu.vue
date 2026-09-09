<script setup lang="ts">
/**
 * The row menu, hanging under one docket's three-dot button: rendered only while it
 * is up, a native `popover`, placed by measuring since Safari has no anchor positioning.
 */
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { displayNumber } from '@/utils'

import { PLACEMENT, SCROLL_SLACK } from './const'
import type { RowMenuEmits, RowMenuProps } from './types'

const props = defineProps<RowMenuProps>()

const emit = defineEmits<RowMenuEmits>()

const rowMenuEl = useTemplateRef<HTMLElement>('rowMenuEl')

/** The docket's number, printed along the top of the panel. */
const number = computed(() => displayNumber(props.task))

/**
 * Whether the panel is up, as far as this component is concerned. Guards against
 * reporting closed twice: hiding a popover comes back as a `toggle` event.
 */
let shown = false

/** Where the three-dot button sat in the window when the panel went up. */
let openedAtAnchorTop = 0

/**
 * Takes the panel away and reports it once. Reported before hiding, since the echo
 * arrives as a `toggle`; hidden rather than unmounted, which is what restores focus.
 *
 * @param byAnchor - Whether a press on the three-dot button is what took it.
 */
function dismiss(byAnchor: boolean): void {
  if (!shown) {
    return
  }

  shown = false
  emit('close', byAnchor)
  rowMenuEl.value?.hidePopover()
}

// [AI assisted 006] 這段時序是踩出來的：popover 的 toggle 事件是非同步派送的，趕不趕得上
// click 在 jsdom 裡驗不到，所以改在 pointerdown 當下同步收掉並回報。
/**
 * A press on the three-dot button, which closes the panel rather than reopening it.
 * Handled at `pointerdown` so the card has the answer before the `click` arrives.
 */
function onPointerDown(event: Event): void {
  if (!(event.target instanceof Node) || !props.anchor.contains(event.target)) {
    return
  }

  dismiss(true)
}

/**
 * The browser took the panel away: a press elsewhere on the page, or Esc. Cast
 * because `ontoggle` is declared as taking a plain `Event`.
 */
function onToggle(event: Event): void {
  if ((event as ToggleEvent).newState === 'closed') {
    dismiss(false)
  }
}

/** Closes the panel and passes the choice up; the sheet is the board's to open. */
function choose(entry: 'edit' | 'delete'): void {
  dismiss(false)

  if (entry === 'edit') {
    emit('edit')
    return
  }

  emit('delete')
}

// [AI assisted 010] 原本比對的是 window.scrollY。托盤改成自己捲之後，捲動的是架上的
// <ul>，window.scrollY 從頭到尾都是 0，面板會停在原地看著卡片從它底下滑走。改成量按鈕
// 本身移動了多少，頁面捲或托盤捲都是同一件事，也不必知道是哪個容器在捲。
/**
 * The panel is fixed to the viewport, so it goes once the card it points at has moved.
 * Measured on the button rather than on the window: what scrolls under an open panel
 * is the shelf's own list, which moves the button while the page stays where it is.
 * Compared against the position recorded when it opened — see `SCROLL_SLACK`.
 */
function onScroll(): void {
  if (Math.abs(props.anchor.getBoundingClientRect().top - openedAtAnchorTop) < SCROLL_SLACK) {
    return
  }

  dismiss(false)
}

/** A resize moves the button under a panel that is pinned to the window. */
function onResize(): void {
  dismiss(false)
}

/**
 * Puts the panel below the three-dot button, or above it if it would not fit. Both
 * boxes are read after it is up, since a popover is `display: none` until then.
 *
 * @param element - The panel, already showing.
 */
function place(element: HTMLElement): void {
  const button = props.anchor.getBoundingClientRect()
  const panel = element.getBoundingClientRect()

  let top = button.bottom + PLACEMENT.gap

  if (top + panel.height > window.innerHeight - PLACEMENT.margin) {
    top = button.top - panel.height - PLACEMENT.gap
  }

  const left = Math.min(
    button.right - panel.width,
    window.innerWidth - panel.width - PLACEMENT.margin,
  )

  element.style.top = `${Math.max(PLACEMENT.margin, top)}px`
  element.style.left = `${Math.max(PLACEMENT.margin, left)}px`
}

onMounted(() => {
  // Capturing, so the press is seen before the browser's light dismiss acts on it.
  // On the document: every press has to be classified, not only this card's.
  document.addEventListener('pointerdown', onPointerDown, true)
  // Capturing: a scroll inside the shelf's list is dispatched on that list and does
  // not bubble, so a plain listener here would only ever hear the page itself scroll.
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)

  const element = rowMenuEl.value

  if (!element) {
    return
  }

  // No `nextTick`: `showPopover()` puts the panel in the top layer synchronously,
  // so the boxes measured on the next line are the ones that will be painted.
  element.showPopover()
  shown = true
  place(element)
  openedAtAnchorTop = props.anchor.getBoundingClientRect().top
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!--
    [AI assisted 006] 曾經寫成 `popover-open:grid`：Tailwind 沒這個 variant，class 被
    靜默丟掉、build 不報錯，面板開起來沒排版。是翻 build 產出的 CSS 才抓到的。
  -->
  <!--
    `open:` compiles to `:is([open], :popover-open, :open)`, forgiving of browsers
    without `:popover-open`. inset-auto and m-0 undo the UA sheet's centring.
  -->
  <div
    ref="rowMenuEl"
    popover
    aria-label="單子操作"
    class="fixed inset-auto m-0 w-[148px] rounded-sm border border-t-[3px] border-rule border-t-ink bg-stock p-1 text-ink shadow-[0_8px_22px_rgba(31,28,24,0.28)] open:grid open:gap-[2px]"
    @toggle="onToggle"
  >
    <!--
      The panel opens away from its card, so it prints the number it is about. Not
      `aria-hidden`: whoever cannot see which docket it hangs over needs it most.
    -->
    <div
      data-number
      class="mb-[2px] border-b border-dashed border-rule px-[9px] pt-1 pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-ink-3"
    >
      {{ number }}
    </div>

    <!--
      `autofocus` rather than our own `focus()`: naming it inside the browser's
      popover-showing steps is what lets it hand focus back to the button after.
    -->
    <button
      type="button"
      data-edit
      autofocus
      class="group flex min-h-11 w-full cursor-pointer appearance-none items-center gap-[9px] rounded-sm border-0 bg-transparent px-[9px] text-left font-display text-[15.5px] tracking-[0.02em] text-ink hover:bg-stamp-bg hover:text-stamp focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-stamp"
      @click="choose('edit')"
    >
      <!-- Decoration: the word beside it already says what the entry does. -->
      <span
        aria-hidden="true"
        class="w-3 text-center font-mono text-[12px] text-ink-3 group-hover:text-stamp"
      >
        ✎
      </span>
      編輯
    </button>

    <button
      type="button"
      data-delete
      class="flex min-h-11 w-full cursor-pointer appearance-none items-center gap-[9px] rounded-sm border-0 bg-transparent px-[9px] text-left font-display text-[15.5px] tracking-[0.02em] text-alert hover:bg-alert-bg focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-stamp"
      @click="choose('delete')"
    >
      <span
        aria-hidden="true"
        class="w-3 text-center font-mono text-[12px] text-alert"
      >
        ×
      </span>
      刪除
    </button>
  </div>
</template>
