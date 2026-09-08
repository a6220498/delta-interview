<script setup lang="ts">
/**
 * The notice a screen puts up when it could not fetch what it was meant to
 * show: what was lost, why, and one way out of it.
 *
 * `docs/ui-spec.html` 節 02「失敗 / Failed」: the message says what to do rather
 * than apologising, so the reason travels in and the way out is a button
 * instead of an instruction to reload the page.
 *
 * Its own component rather than markup on the board, because the board is not
 * the only thing that can fail to load and a notice written into one screen
 * cannot be put on the next one. It stays a pure statement — no store, no
 * fetch, no knowledge of what failed — so the screen that raises it keeps
 * deciding what 重試 costs.
 */
import type { LoadFailureEmits, LoadFailureProps } from './types'

defineProps<LoadFailureProps>()

const emit = defineEmits<LoadFailureEmits>()
</script>

<template>
  <!--
    role="alert" because nobody asked for the load that failed — it runs on its
    own — so without an announcement a screen-reader user meets an empty screen
    with no idea why it is empty.

    No margin of its own: where the notice sits relative to what it is about
    belongs to the screen that raises it, and arrives as a fallthrough class.
  -->
  <div
    role="alert"
    class="rounded-sm border border-alert bg-alert-bg px-[11px] py-[9px]"
  >
    <strong class="block font-display text-[15px] tracking-[0.01em] text-alert">
      工單載不出來
    </strong>

    <!-- The server's own problem detail: "沒載到" alone gives nothing to act on. -->
    <span class="text-[12.5px] text-ink-2">{{ reason }}</span>

    <!--
      A backend that was down at first paint must not cost a page reload once
      it is back up. Outlined rather than filled: it offers a way out of the
      failure, and a solid alert-coloured button reads as the destructive kind.
    -->
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
