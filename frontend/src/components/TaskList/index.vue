<script setup lang="ts">
/**
 * One shelf of the board, rendered once per rack: everything that differs arrives
 * in `rack`. It takes its tasks as a prop and does no filtering of its own.
 */
import Card from './Card.vue'
import type { TaskListEmits, TaskListProps } from './types'

const props = defineProps<TaskListProps>()

const emit = defineEmits<TaskListEmits>()
</script>

<template>
  <!--
    The heavy ink edge runs along the top only, like a tray's front lip. min-h
    keeps an empty shelf from collapsing next to a full one.
  -->
  <div
    data-tray
    :aria-busy="props.loading ? true : undefined"
    class="flex min-h-[220px] flex-col border border-t-[3px] border-tray-edge border-t-ink bg-tray p-2.5"
  >
    <div class="flex items-center gap-2 px-1 pt-0.5 pb-2.5">
      <!-- Preflight strips a heading's own size and weight, so both are stated. -->
      <h3 class="font-display text-[15px] font-semibold tracking-[0.1em] uppercase">
        {{ props.rack.title }}
      </h3>

      <!-- Left in the accessibility tree: read after the heading it says "未完成, 3". -->
      <span
        data-tally
        class="min-w-[26px] rounded-sm px-1.5 pt-[5px] pb-1.5 text-center text-[15px] leading-none font-bold tabular-nums text-stock"
        :class="props.rack.tally"
      >
        {{ props.tasks.length }}
      </span>

      <!-- Lettering stamped into the tray; announcing it would repeat 未完成 in English. -->
      <span
        data-hint
        aria-hidden="true"
        class="ml-auto border-b border-ink pb-px font-display text-[11.5px] font-semibold tracking-[0.18em] uppercase"
      >
        {{ props.rack.hint }}
      </span>
    </div>

    <!--
      Replaces the list rather than sitting inside it, so an empty shelf is never
      announced as a list of one. The same box carries the wait, keeping the height.
    -->
    <p
      v-if="props.tasks.length === 0"
      class="flex flex-1 items-center justify-center rounded-sm border border-dashed border-tray-edge px-2 py-[22px] text-center font-mono text-[11.5px] tracking-[0.06em] text-ink-2"
    >
      {{ props.loading ? '載入中 —— 正在取回架上的單子' : props.rack.empty }}
    </p>

    <!--
      role="list" is explicit: preflight strips the markers and some browsers drop
      list semantics with them, costing the "3 items" a reader gets up front.
    -->
    <ul
      v-else
      role="list"
      class="flex flex-col gap-[9px]"
    >
      <li
        v-for="task in props.tasks"
        :key="task.id"
      >
        <Card
          :task="task"
          @toggle="emit('toggle', task, $event)"
          @edit="emit('edit', task)"
          @delete="emit('delete', task)"
        />
      </li>
    </ul>
  </div>
</template>
