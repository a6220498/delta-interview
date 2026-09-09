<script setup lang="ts">
import type { LoadFailureEmits, LoadFailureProps } from './types'

defineProps<LoadFailureProps>()

const emit = defineEmits<LoadFailureEmits>()
</script>

<template>
  <div
    role="alert"
    class="rounded-sm border border-alert bg-alert-bg px-[11px] py-[9px]"
  >
    <strong class="block font-display text-[15px] tracking-[0.01em] text-alert">
      工單載不出來
    </strong>

    <span class="text-[12.5px] text-ink-2">{{ reason }}</span>

    <button
      type="button"
      data-retry
      class="mt-1.5 block min-h-[28px] cursor-pointer appearance-none rounded-sm border border-alert bg-transparent px-[9px] py-1 font-mono text-[10.5px] tracking-[0.06em] text-alert hover:border-alert-2 hover:text-alert-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
      @click="emit('retry')"
    >
      重試
    </button>
  </div>
</template>
