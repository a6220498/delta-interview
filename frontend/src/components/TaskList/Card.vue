<script setup lang="ts">
/**
 * One task, drawn as a paper docket: a perforated stub on the left carrying the
 * category mark and the number, the title and its two controls on the right.
 *
 * The card renders state and reports intent; it decides nothing. Completion and
 * the row menu leave as events, so the card never learns what finishing a task
 * costs or where the menu opens.
 *
 * Three states share this one template, and each differs in shape as well as in
 * colour — the board has to stay readable to someone who cannot tell the red
 * from the purple. Open is the plain docket; overdue reddens the stub and adds a
 * 逾期 tag; done switches to the second-copy stock, strikes the title through
 * and stamps the card. Overdue is layered on open and disappears once stamped,
 * which is why `stub` tests `completed` first.
 */
import { computed } from 'vue'

import { categoryDisplay, displayNumber, formatDueDate, isOverdue } from '@/utils/task'

import { LABELS } from './const'
import type { CardEmits, CardProps } from './types'

const props = defineProps<CardProps>()

const emit = defineEmits<CardEmits>()

const number = computed(() => displayNumber(props.task))
const category = computed(() => categoryDisplay(props.task.category))
const overdue = computed(() => isOverdue(props.task))
const stateLabel = computed(() => (props.task.completed ? LABELS.done : LABELS.open))

/**
 * The stub's paper and ink for the card's current state, plus the colour the
 * mark's letter is knocked out in.
 *
 * Kept as one object so the knockout can never fall out of step with the paper
 * behind it — a solid mark whose letter is painted the wrong colour disappears.
 */
const stub = computed(() => {
  if (props.task.completed) {
    return { paper: 'bg-stamp-bg', ink: 'text-stamp', knockout: 'text-stamp-bg' }
  }
  if (overdue.value) {
    return { paper: 'bg-alert-bg', ink: 'text-alert', knockout: 'text-alert-bg' }
  }
  return { paper: 'bg-stub', ink: 'text-ink-3', knockout: 'text-stub' }
})

/** Names the mark's current state and the state pressing it would ask for. */
const markLabel = computed(
  () => `狀態：${stateLabel.value}，按下標記為${props.task.completed ? LABELS.open : LABELS.done}`,
)
</script>

<template>
  <article
    class="relative grid grid-cols-[26px_1fr] rounded-sm border border-rule shadow-[0_1px_0_rgba(31,28,24,0.18)]"
    :class="task.completed ? 'bg-stock-2' : 'bg-stock'"
  >
    <!--
      The stub's two round punches are painted the tray's colour, so the card
      reads as pierced rather than as decorated. They sit outside the stub's
      box, which is why the stub is the positioning context.
    -->
    <div
      class="relative flex flex-col items-center justify-center gap-[7px] rounded-l-sm border-r border-dashed border-rule py-2 before:absolute before:-top-1 before:-right-1 before:size-[7px] before:rounded-full before:bg-tray before:content-[''] after:absolute after:-right-1 after:-bottom-1 after:size-[7px] after:rounded-full after:bg-tray after:content-['']"
      :class="[stub.paper, stub.ink]"
    >
      <!--
        Filled for bug, outlined for feature. Hidden from assistive tech: the
        number below already spells the category out, so announcing the mark
        would say it twice.
      -->
      <span
        data-category
        aria-hidden="true"
        class="grid size-[15px] flex-none place-items-center rounded-sm border-[1.5px] border-current font-mono text-[9px] leading-none font-bold"
        :class="{ 'bg-current': category.solid }"
      >
        <span :class="category.solid ? stub.knockout : undefined">{{ category.mark }}</span>
      </span>

      <code
        class="font-mono text-[10.5px] font-bold tracking-[0.1em] tabular-nums [writing-mode:vertical-rl]"
      >
        {{ number }}
      </code>
    </div>

    <div class="min-w-0 px-[11px] pt-[9px] pb-2">
      <!--
        anywhere lets an unbroken string wrap mid-word instead of widening the
        card; pr-26px keeps the last line clear of the menu button above it.
      -->
      <p
        class="mb-2 pr-[26px] font-display text-[17px] leading-[1.3] font-medium [overflow-wrap:anywhere]"
        :class="
          task.completed ? 'text-ink-2 line-through decoration-stamp decoration-[1.5px]' : 'text-ink'
        "
      >
        {{ task.title }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <!--
          The visible box is 24px; the ::before overlay grows the hit area to
          44px without moving anything on the page. 11px rather than the spec's
          10px because the overlay is inset from the padding box, so the
          button's own 1px border has to be paid for on each side — at 10px the
          target measures 42px and misses the 44px minimum the spec asks for.
        -->
        <button
          type="button"
          :aria-pressed="task.completed"
          :aria-label="markLabel"
          class="relative inline-flex min-h-6 cursor-pointer appearance-none items-center gap-1.5 rounded-sm border bg-transparent py-[3px] pr-[7px] pl-[5px] font-mono text-[10.5px] tracking-[0.06em] before:absolute before:-inset-x-[2px] before:-inset-y-[11px] before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
          :class="
            task.completed
              ? 'border-stamp text-stamp'
              : 'border-rule text-ink-2 hover:border-ink-2 hover:text-ink'
          "
          @click="emit('toggle', !task.completed)"
        >
          <!-- The tick is always drawn and only inked once done, so the box never resizes. -->
          <span
            aria-hidden="true"
            class="grid size-3 place-items-center border-[1.5px] text-[10px] leading-none"
            :class="
              task.completed ? 'border-stamp bg-stamp text-stock' : 'border-ink-3 text-transparent'
            "
          >
            ✓
          </span>
          {{ stateLabel }}
        </button>

        <span
          class="inline-flex items-center gap-[5px] font-mono text-[11px] tabular-nums"
          :class="overdue ? 'font-bold text-alert' : 'text-ink-3'"
        >
          {{ formatDueDate(task.dueDate) }}
          <!--
            A real element rather than the spec's CSS `content`, which assistive
            tech is not required to announce. Overdue is the one state that
            costs the reader something, so it may not be colour-only.
          -->
          <span
            v-if="overdue"
            class="border border-alert px-1 text-[9.5px] font-normal tracking-[0.08em]"
          >
            逾期
          </span>
        </span>
      </div>
    </div>

    <!-- The card's only control besides the mark; everything else lives in the menu. -->
    <button
      type="button"
      :aria-label="`${number} 的操作選單`"
      aria-haspopup="true"
      class="absolute top-1 right-1 grid size-[26px] cursor-pointer place-content-center gap-[3px] rounded-sm border-0 bg-transparent before:absolute before:-inset-[9px] before:content-[''] hover:bg-stamp-bg hover:text-stamp focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
      :class="task.completed ? 'text-ink-2' : 'text-ink-3'"
      @click="emit('menu')"
    >
      <span
        v-for="dot in 3"
        :key="dot"
        class="block size-[3px] rounded-full bg-current"
      />
    </button>

    <!-- Decoration: the mark button already announces the card as 已完成. -->
    <span
      v-if="task.completed"
      aria-hidden="true"
      class="pointer-events-none absolute right-2 bottom-1.5 rotate-[-8deg] rounded-sm border-2 border-stamp px-1.5 py-px font-display text-[11px] font-bold tracking-[0.14em] text-stamp opacity-55"
    >
      完成 DONE
    </span>
  </article>
</template>
