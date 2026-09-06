<script setup lang="ts">
import type { Task } from '@/types/task'

const props = defineProps<{
  /** The task to render. */
  task: Task
}>()

const emit = defineEmits<{
  /** Requests the task be set to an explicit completion state. */
  setCompleted: [completed: boolean]
  /** Requests the task be deleted. */
  remove: []
}>()

/**
 * Forwards the checkbox's resulting state to the parent.
 *
 * Emits the target state rather than "toggle" so the parent can call the
 * contract's idempotent completion endpoint; deriving the next state from the
 * old one is what makes double clicks race.
 *
 * @param event - the checkbox change event.
 */
function onToggle(event: Event): void {
  emit('setCompleted', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <li class="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
    <!-- The checkbox paints at 20px, but the label around it carries the
         44x44 touch target (WCAG 2.5.8); negative margins let it bleed into the
         row padding so the row does not grow to accommodate it. -->
    <label class="-my-2.5 -ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        class="size-5 accent-accent"
        :checked="props.task.completed"
        :aria-label="`標記完成：${props.task.title}`"
        @change="onToggle"
      >
    </label>

    <!-- min-w-0 lets the text wrap instead of forcing the row to overflow. -->
    <div class="min-w-0 flex-1">
      <p
        class="text-sm font-medium break-words"
        :class="props.task.completed ? 'text-muted line-through' : 'text-ink'"
      >
        {{ props.task.title }}
      </p>
      <p
        v-if="props.task.description"
        class="mt-0.5 text-xs text-muted break-words"
      >
        {{ props.task.description }}
      </p>
    </div>

    <!-- 44px minimum touch target (WCAG 2.5.8). -->
    <button
      type="button"
      class="-my-1 flex size-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      :aria-label="`刪除任務：${props.task.title}`"
      @click="emit('remove')"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </li>
</template>
