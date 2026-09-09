<script setup lang="ts">
/**
 * The shelf switch the board wears at phone widths: one segment per rack, of which
 * exactly one shelf is on screen. It reports the press and switches nothing itself.
 */
import type { RackSwitchEmits, RackSwitchProps } from './types'

const props = defineProps<RackSwitchProps>()

const emit = defineEmits<RackSwitchEmits>()
</script>

<template>
  <!-- [AI assisted 009] 選 role="group" + aria-pressed，否決了 tablist/tab 與 radiogroup：
       那兩套都欠使用者方向鍵導覽，而且 >700px 兩架同時在畫面上時，「分頁」沒有對應的
       panel 可切，語意會變成假的。 -->
  <!--
    Not drawn until 700px: above it the board shows both shelves at once, and a
    switch between two things already on screen would be a control over nothing.
  -->
  <div
    role="group"
    aria-label="架別"
    class="mb-2.5 hidden border-[1.5px] border-ink max-[700px]:flex"
  >
    <!-- [AI assisted 009] min-h-11（44px）刻意偏離規格的 40px：規格 03 節那張 mock 裡
         這兩格是不可點的 <span>，變成真按鈕之後，專案規則的 44×44 命中區就適用了。 -->
    <!--
      The ink block is drawn from aria-pressed rather than beside it, so the shelf
      that looks selected and the shelf a reader is told is selected cannot drift.
    -->
    <button
      v-for="rack in props.racks"
      :key="rack.id"
      type="button"
      :aria-pressed="rack.id === props.modelValue"
      class="inline-flex min-h-11 flex-1 cursor-pointer appearance-none items-center justify-center border-l-[1.5px] border-ink bg-transparent px-0.5 py-[9px] text-center font-mono text-[11px] tracking-[0.04em] whitespace-nowrap text-ink-2 first:border-l-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stamp aria-pressed:bg-ink aria-pressed:text-stock"
      @click="emit('update:modelValue', rack.id)"
    >
      {{ rack.title }} {{ props.counts[rack.id] ?? 0 }}
    </button>
  </div>
</template>
