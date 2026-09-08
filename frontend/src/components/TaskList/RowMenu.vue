<script setup lang="ts">
/**
 * The row menu: 編輯 and 刪除 on a small sheet, hanging under one docket's
 * three-dot button.
 *
 * The card renders this only while the menu is up, so a board of thirty dockets
 * carries no thirty hidden panels — and the component's existence *is* the menu
 * being open. That is why there is nothing here to call: it takes the docket and
 * the button it hangs from as props, puts itself up as it mounts, and reports
 * `close` on every way it can go back down. The card holds the one fact, this
 * holds the behaviour, and there is no second copy of "is the menu open" to
 * disagree with the first.
 *
 * A native `popover`, which the spec picks for four things that would otherwise
 * be hand-built: it opens in the top layer, so neither the tray's box nor the
 * next docket can clip or cover it; a press outside dismisses it; Esc dismisses
 * it; and closing hands focus back to the three-dot button.
 *
 * Placed by measuring rather than by CSS anchor positioning, which Safari does
 * not have: the button's box and the panel's own are read back once the panel is
 * up, and it goes below the button unless it would fall off the bottom of the
 * window, in which case it flips above it.
 */
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { displayNumber } from '@/utils/task'

import { PLACEMENT, SCROLL_SLACK } from './const'
import type { RowMenuEmits, RowMenuProps } from './types'

const props = defineProps<RowMenuProps>()

const emit = defineEmits<RowMenuEmits>()

const rowMenuEl = useTemplateRef<HTMLElement>('rowMenuEl')

/** The docket's number, printed along the top of the panel. */
const number = computed(() => displayNumber(props.task))

/**
 * Whether the panel is up, as far as this component is concerned.
 *
 * Plain `let` rather than a ref: nothing on the page is drawn from it. It exists
 * so the panel is neither hidden twice nor reported closed twice — hiding a
 * popover comes back as a `toggle` event, which is the same news arriving a
 * second time.
 */
let shown = false

/** Where the page was scrolled to when the panel went up. */
let openedAtScrollY = 0

/**
 * Takes the panel away, and reports it — once, whatever else asks afterwards.
 *
 * Reported before it is hidden rather than after: `hidePopover()` comes back as
 * a `toggle` event, and the order the two arrive in is the browser's business.
 * Saying it first means the answer below cannot be overwritten by that echo.
 *
 * `hidePopover()` at all, rather than leaving the card to unmount the element:
 * hiding a popover is what hands focus back to the three-dot button, and an
 * element taken out of the page while still showing takes the focus with it.
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

// [AI assisted 006] 這段的時序是踩出來的。三點鈕要能「再按一次關掉」，而 popover 的
// light dismiss 在 click 之前就把面板收掉了。前一版（板子共用的面板）先用「比對單號」，
// 會讓滑鼠按過面板裡的編輯之後、再用鍵盤 Enter 同一張卡的第一次被吃掉；改成
// `anchor.contains(按下去的東西)` 又恆真，按別張卡變成關閉。搬進卡片後索性不再依賴
// popover 的 toggle 事件 —— 它是排進 task queue 非同步派送的，而「會不會趕在 click
// 前面」在 jsdom 裡驗不到，所以改在 pointerdown 當下同步收掉並回報。
/**
 * A press on the three-dot button, which closes the panel rather than reopening
 * it.
 *
 * Handled here, at `pointerdown`, rather than left to the browser's own light
 * dismiss: that dismissal is reported through the popover's `toggle` event,
 * which is dispatched from a queued task, and the card needs the answer before
 * the `click` this same press is about to produce. Taking the panel away here
 * is synchronous, so the order is not something to hope for.
 *
 * Every other press outside the panel is left to the browser — see `onToggle`.
 */
function onPointerDown(event: Event): void {
  if (!(event.target instanceof Node) || !props.anchor.contains(event.target)) {
    return
  }

  dismiss(true)
}

/**
 * The browser took the panel away: a press elsewhere on the page, or Esc.
 *
 * Cast because `ontoggle` is declared as taking a plain `Event` — `ToggleEvent`
 * is what is actually dispatched, and `newState` is the only field read.
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

/**
 * The panel is fixed to the viewport, so it has to go once the card it points at
 * has moved. Compared against the position recorded when it opened rather than
 * against "a scroll event arrived" — see `SCROLL_SLACK`.
 */
function onScroll(): void {
  if (Math.abs(window.scrollY - openedAtScrollY) < SCROLL_SLACK) {
    return
  }

  dismiss(false)
}

/** A resize moves the button under a panel that is pinned to the window. */
function onResize(): void {
  dismiss(false)
}

/**
 * Puts the panel below the three-dot button, or above it if it would not fit.
 *
 * Both boxes are read after the panel is up, because a popover is `display:
 * none` until then and would measure zero. The horizontal edge is the button's
 * right one — the panel hangs back into the card rather than off the side of it
 * — clamped so that neither edge of the window can cut it off.
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
  // Capturing, so the press is seen before the browser's light dismiss acts on
  // it. On the document rather than on the button: every press has to be
  // classified, not only the ones that land on this card.
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('scroll', onScroll)
  window.addEventListener('resize', onResize)

  const element = rowMenuEl.value

  if (!element) {
    return
  }

  // No `nextTick`: the panel is mounted with its number already rendered, and
  // `showPopover()` puts it in the top layer synchronously, so the boxes
  // measured on the next line are the ones that will be painted.
  element.showPopover()
  shown = true
  place(element)
  openedAtScrollY = window.scrollY
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <!--
    [AI assisted 006] 這裡曾經寫成 `popover-open:grid`，型別檢查、lint、單元測試全過，
    但 Tailwind 沒有這個 variant，兩條 class 會被靜默丟掉、build 也不報錯，面板開起來
    沒有排版。是去翻 build 產出的 CSS 才抓到的。
  -->
  <!--
    `open:` rather than `popover-open:` — Tailwind has no variant under the
    second name and drops the two utilities silently, leaving the panel
    unstyled with no build error. `open:` compiles to
    `:is([open], :popover-open, :open)`, which is forgiving, so a browser
    without `:popover-open` still matches on the rest.

    inset-auto and m-0 undo what the UA sheet gives a popover — it is centred
    by default, and the panel is positioned by hand.
  -->
  <div
    ref="rowMenuEl"
    popover
    aria-label="單子操作"
    class="fixed inset-auto m-0 w-[148px] rounded-sm border border-t-[3px] border-rule border-t-ink bg-stock p-1 text-ink shadow-[0_8px_22px_rgba(31,28,24,0.28)] open:grid open:gap-[2px]"
    @toggle="onToggle"
  >
    <!--
      The panel opens in the top layer, away from the card it belongs to, so it
      prints the number it is about. Not `aria-hidden`: someone who cannot see
      which docket the panel is hanging over needs it more than anyone.
    -->
    <div
      data-number
      class="mb-[2px] border-b border-dashed border-rule px-[9px] pt-1 pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-ink-3"
    >
      {{ number }}
    </div>

    <!--
      `autofocus` rather than a `focus()` of our own: naming the entry inside the
      browser's own popover-showing steps is what leaves it able to hand focus
      back to the three-dot button afterwards. 44px rows, as everywhere else a
      finger has to land.
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
