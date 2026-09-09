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

          <!-- cursor-pointer is explicit: Tailwind 4 preflight gives buttons `cursor: default`. -->
          <button
            type="button"
            class="inline-flex min-h-[34px] cursor-pointer appearance-none items-center gap-[7px] self-center rounded-sm border border-ink bg-ink px-3.5 font-display text-[14.5px] font-semibold tracking-[0.05em] whitespace-nowrap text-stock hover:border-stamp hover:bg-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
            @click="emit('action')"
          >
            <!-- Full-width ＋ to match the CJK label's weight; announced by the label, not by this. -->
            <span aria-hidden="true">＋</span>{{ actionLabel }}
          </button>
        </div>

        <slot />
      </section>
    </main>
  </div>
</template>
