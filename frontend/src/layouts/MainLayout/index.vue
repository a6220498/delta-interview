<script setup lang="ts">
import { MAIN_LAYOUT_DEFAULTS } from './const'
import type { MainLayoutEmits, MainLayoutProps } from './types'

withDefaults(defineProps<MainLayoutProps>(), MAIN_LAYOUT_DEFAULTS)

// [AI assisted 006] 主要動作走 emit 而不是 function prop：一樣是外部傳入，但這條列
// 只負責按鈕長什麼樣，不必知道按下去要花多少代價。
const emit = defineEmits<MainLayoutEmits>()
</script>

<template>
  <!-- [AI assisted 010] 由 AI 改成滿版高度：原本頁面長度跟著托盤裡的卡片一起長，卡片一多
       整頁就出現捲軸。改法是把外框釘死成一個視窗高的欄，中間每一層都 min-h-0，捲軸留給
       托盤自己的清單 —— 少任何一層的 min-h-0，那一層就會用內容高度撐開，整條鏈就斷了。 -->

  <div class="mx-auto flex h-dvh w-full max-w-[1060px] flex-col px-5 pb-5 max-[700px]:pb-10">
    <header class="pt-[38px]">
      <slot name="header" />
    </header>

    <main class="flex min-h-0 flex-1 flex-col">
      <section class="mt-[54px] flex min-h-0 flex-1 flex-col">
        <div class="mb-[18px] flex items-baseline gap-3 border-b border-ink pb-1.5">
          <h2 class="grow font-display text-[21px] font-semibold tracking-[0.01em]">
            {{ heading }}
          </h2>
          <!-- Add task btn -->
          <button
            type="button"
            class="inline-flex min-h-[34px] cursor-pointer appearance-none items-center gap-[7px] self-center rounded-sm border border-ink bg-ink px-3.5 font-display text-[14.5px] font-semibold tracking-[0.05em] whitespace-nowrap text-stock hover:border-stamp hover:bg-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp max-[700px]:hidden"
            @click="emit('action')"
          >

            <span aria-hidden="true">＋</span>{{ actionLabel }}
          </button>
        </div>

        <slot />
      </section>
    </main>

    <!-- [AI assisted 009] 兩顆按鈕，而不是一顆用 CSS 搬位置：同一顆要同時當標題列的
         34px 墨條與角落的 56px 圓鈕，等於整組樣式在斷點兩邊各寫一次。拆成兩顆之後各自
         只有一種長相，代價是 DOM 裡有兩顆同名按鈕 —— 任一寬度只有一顆 display 得出來。 -->
    <button
      type="button"
      :aria-label="actionLabel"
      class="fixed right-4 bottom-4 z-40 hidden size-14 cursor-pointer appearance-none place-items-center rounded-full bg-ink font-mono text-[26px] leading-none text-stock shadow-[0_3px_12px_rgba(31,28,24,0.34)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-stamp max-[700px]:grid"
      @click="emit('action')"
    >
      ＋
    </button>
  </div>
</template>
