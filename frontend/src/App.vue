<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import TaskComposer from '@/components/TaskComposer.vue'
import TaskItem from '@/components/TaskItem.vue'
import { useTaskStore } from '@/stores/tasks'
import type { TaskFilter } from '@/types/task'

const store = useTaskStore()
const { tasks, filter, isLoading, error, remainingCount } = storeToRefs(store)

const FILTERS: ReadonlyArray<{ value: TaskFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '未完成' },
  { value: 'completed', label: '已完成' },
]

onMounted(() => store.load())
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 p-4">
    <header>
      <!-- Preflight strips heading sizes, so they are set explicitly. -->
      <h1 class="text-2xl font-semibold text-ink">
        任務清單
      </h1>
      <p class="mt-1 text-sm text-muted">
        還有 {{ remainingCount }} 項未完成
      </p>
    </header>

    <TaskComposer @create="(title) => store.add({ title })" />

    <nav
      class="flex gap-1"
      aria-label="任務篩選"
    >
      <button
        v-for="option in FILTERS"
        :key="option.value"
        type="button"
        class="h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :class="filter === option.value ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-line/50'"
        :aria-pressed="filter === option.value"
        @click="store.setFilter(option.value)"
      >
        {{ option.label }}
      </button>
    </nav>

    <p
      v-if="error"
      class="error-banner rounded-panel border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
      role="alert"
    >
      {{ error }}
    </p>

    <main class="overflow-hidden rounded-panel border border-line bg-surface">
      <p
        v-if="isLoading && tasks.length === 0"
        class="px-4 py-8 text-center text-sm text-muted"
      >
        載入中…
      </p>
      <p
        v-else-if="tasks.length === 0"
        class="px-4 py-8 text-center text-sm text-muted"
      >
        目前沒有任務。
      </p>
      <ul v-else>
        <TaskItem
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @set-completed="(completed) => store.setCompletion(task.id, completed)"
          @remove="store.remove(task.id)"
        />
      </ul>
    </main>
  </div>
</template>

<style scoped lang="scss">
// Tailwind can attach an animation but cannot express "…unless the user asked
// for reduced motion", so the mixin from src/styles/_core.scss covers it.
@use 'core' as core;

.error-banner {
  @include core.motion-safe-animation(error-in 150ms ease-out);
}

@keyframes error-in {
  from {
    opacity: 0;
    transform: translateY(-0.25rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
