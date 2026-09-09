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
  <div
    role="group"
    aria-label="架別"
    class="mb-2.5 hidden border-[1.5px] border-ink max-[700px]:flex"
  >
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
