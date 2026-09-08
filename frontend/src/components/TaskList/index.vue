<script setup lang="ts">
/**
 * One shelf of the board: a recessed tray holding the dockets for a single
 * completion state, with the rack's name, a tally of what is on it and the
 * pressed lettering a physical in/out tray carries.
 *
 * Deliberately one component rendered once per rack rather than a component
 * per rack. The two trays are the same object in every respect but four words
 * and a colour, so a pair of near-identical files would drift the moment one of
 * them is touched. Everything that differs arrives in `rack`, one row of the
 * board's table — the tray draws that row and holds no table of its own, so it
 * cannot disagree with the board about what a shelf is called.
 *
 * The tray takes its tasks as a prop and does no filtering: which tasks belong
 * on which shelf is one decision, and making it twice — once per instance —
 * is how a task ends up on both shelves or on neither.
 */
import Card from './Card.vue'
import type { TaskListEmits, TaskListProps } from './types'

const props = defineProps<TaskListProps>()

const emit = defineEmits<TaskListEmits>()
</script>

<template>
  <!--
    The heavy ink edge runs along the top only, the way a tray's front lip is
    the one you see; the other three sides are the shallow tray-edge. min-h
    keeps an empty shelf from collapsing next to a full one.
  -->
  <div class="flex min-h-[220px] flex-col border border-t-[3px] border-tray-edge border-t-ink bg-tray p-2.5">
    <div class="flex items-center gap-2 px-1 pt-0.5 pb-2.5">
      <!-- Preflight strips a heading's own size and weight, so both are stated. -->
      <h3 class="font-display text-[15px] font-semibold tracking-[0.1em] uppercase">
        {{ props.rack.title }}
      </h3>

      <!--
        Left in the accessibility tree on purpose: read straight after the
        heading it says "未完成, 3", which is the whole point of the tally.
      -->
      <span
        data-tally
        class="min-w-[26px] rounded-sm px-1.5 pt-[5px] pb-1.5 text-center text-[15px] leading-none font-bold tabular-nums text-stock"
        :class="props.rack.tally"
      >
        {{ props.tasks.length }}
      </span>

      <!--
        Lettering stamped into the tray itself, not a second name for the rack —
        announcing it would repeat 未完成 in English.
      -->
      <span
        data-hint
        aria-hidden="true"
        class="ml-auto border-b border-ink pb-px font-display text-[11.5px] font-semibold tracking-[0.18em] uppercase"
      >
        {{ props.rack.hint }}
      </span>
    </div>

    <!--
      The empty notice replaces the list rather than sitting inside it, so an
      empty shelf is never announced as a list of one.
    -->
    <p
      v-if="props.tasks.length === 0"
      class="flex flex-1 items-center justify-center rounded-sm border border-dashed border-tray-edge px-2 py-[22px] text-center font-mono text-[11.5px] tracking-[0.06em] text-ink-2"
    >
      {{ props.rack.empty }}
    </p>

    <!--
      role="list" is explicit because preflight strips the list markers, and
      some browsers drop list semantics along with them — which would cost the
      "3 items" a reader gets before deciding whether to go through the shelf.
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
