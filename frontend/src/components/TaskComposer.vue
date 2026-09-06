<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  /** Requests creation of a task with the given (trimmed, non-empty) title. */
  create: [title: string]
}>()

const title = ref('')

/**
 * Validates and emits the new task title.
 *
 * Rejects a whitespace-only title locally rather than letting the backend
 * answer 400: the contract's `minLength: 1` is known here, and a round trip to
 * be told what we could already tell is wasted latency and a worse error.
 */
function onSubmit(): void {
  const trimmed = title.value.trim()
  if (trimmed === '') {
    return
  }
  emit('create', trimmed)
  title.value = ''
}
</script>

<template>
  <form
    class="flex gap-2"
    @submit.prevent="onSubmit"
  >
    <input
      v-model="title"
      type="text"
      class="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      placeholder="新增任務…"
      aria-label="新任務標題"
      maxlength="200"
    >
    <button
      type="submit"
      class="h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      新增
    </button>
  </form>
</template>
