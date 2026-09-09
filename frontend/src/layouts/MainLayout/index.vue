<script setup lang="ts">
/**
 * The page frame every screen sits in: the `.wrap` metrics from `docs/ui-spec.html`,
 * the two landmarks, and the heading row. The masthead is slotted, not baked in.
 */
import { MAIN_LAYOUT_DEFAULTS } from './const'
import type { MainLayoutEmits, MainLayoutProps } from './types'

withDefaults(defineProps<MainLayoutProps>(), MAIN_LAYOUT_DEFAULTS)

// [AI assisted 006] 主要動作走 emit 而不是 function prop：一樣是外部傳入，但這條列
// 只負責按鈕長什麼樣，不必知道按下去要花多少代價。
const emit = defineEmits<MainLayoutEmits>()
</script>

<template>
  <!-- pb-18 (72px) keeps the last card clear of the mobile floating button. -->
  <div class="mx-auto w-full max-w-[1060px] px-5 pb-18">
    <header class="pt-[38px]">
      <slot name="header" />
    </header>

    <main>
      <!--
        A plain <section>: with no accessible name it stays out of the landmark
        list, so the page keeps the two landmarks the layout promises.
      -->
      <section class="mt-[54px]">
        <!--
          Baseline alignment sits title and button text on one line; the button
          opts out with self-center, since a 34px box on a baseline reads as slipped.
        -->
        <div class="mb-[18px] flex items-baseline gap-3 border-b border-ink pb-1.5">
          <!-- Preflight strips heading size and weight; grow pushes the button right. -->
          <h2 class="grow font-display text-[21px] font-semibold tracking-[0.01em]">
            {{ heading }}
          </h2>

          <!--
            cursor-pointer is explicit: Tailwind 4 preflight gives buttons `cursor: default`.
            Gone below 700px, where the floating button under the board takes over —
            a 34px box is under the 44px a thumb needs, and the row is tight there.
          -->
          <button
            type="button"
            class="inline-flex min-h-[34px] cursor-pointer appearance-none items-center gap-[7px] self-center rounded-sm border border-ink bg-ink px-3.5 font-display text-[14.5px] font-semibold tracking-[0.05em] whitespace-nowrap text-stock hover:border-stamp hover:bg-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp max-[700px]:hidden"
            @click="emit('action')"
          >
            <!-- Full-width ＋ to match the CJK label's weight; announced by the label, not by this. -->
            <span aria-hidden="true">＋</span>{{ actionLabel }}
          </button>
        </div>

        <slot />
      </section>
    </main>

    <!-- [AI assisted 009] 兩顆按鈕，而不是一顆用 CSS 搬位置：同一顆要同時當標題列的
         34px 墨條與角落的 56px 圓鈕，等於整組樣式在斷點兩邊各寫一次。拆成兩顆之後各自
         只有一種長相，代價是 DOM 裡有兩顆同名按鈕 —— 任一寬度只有一顆 display 得出來。 -->
    <!--
      The same action again, in the corner a thumb reaches. Only ever one of the two
      is displayed, so the frame never offers 新增工單 twice — this one below 700px,
      the heading row's above it. Fixed to the viewport rather than to the board: the
      pb-18 above is what keeps it off the last card.
    -->
    <button
      type="button"
      :aria-label="actionLabel"
      class="fixed right-4 bottom-4 z-40 hidden size-14 cursor-pointer appearance-none place-items-center rounded-full bg-ink font-mono text-[26px] leading-none text-stock shadow-[0_3px_12px_rgba(31,28,24,0.34)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-stamp max-[700px]:grid"
      @click="emit('action')"
    >
      <!-- The name is the label above; this glyph is the button's whole face. -->
      ＋
    </button>
  </div>
</template>
