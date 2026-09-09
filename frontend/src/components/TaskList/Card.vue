<script setup lang="ts">
/**
 * One task drawn as a paper docket. It files its own stamp and passes the menu's two
 * choices up; its three states differ in shape as well as colour, never colour alone.
 */
import { computed, ref, useTemplateRef } from 'vue'

import { WRITE_THROTTLE_MS } from '@/const/interaction'
import { useTasksStore } from '@/stores/tasks'
import { categoryDisplay, displayNumber, formatDueDate, isOverdue, throttle } from '@/utils'

import { LABELS } from './const'
import RowMenu from './RowMenu.vue'
import type { CardEmits, CardProps } from './types'

const props = defineProps<CardProps>()

const emit = defineEmits<CardEmits>()

/**
 * The board's tasks, and the request that stamps one. Written through the store rather
 * than reported upwards: which shelf this docket hangs on is read off the row below.
 */
const tasksStore = useTasksStore()

const number = computed(() => displayNumber(props.task))
const category = computed(() => categoryDisplay(props.task.category))
const overdue = computed(() => isOverdue(props.task))
const stateLabel = computed(() => (props.task.completed ? LABELS.done : LABELS.open))

/**
 * The stub's paper, ink and knockout colour for the current state. One object, so
 * the knockout cannot fall out of step with the paper behind it.
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

/**
 * Why the last stamp came back refused, or empty while none has. It needs no clearing
 * on success: a stamp that lands moves the docket, and this card goes with it.
 */
const toggleError = ref('')

/**
 * Whether a stamp is on the wire. A plain `let`: nothing draws it, and a spinner that
 * appears and vanishes inside a frame is worse than none at all.
 */
let stamping = false

/**
 * Files the state the mark was pressed for, which is what moves the docket to the other
 * shelf. A refusal is printed on the card, since a refused stamp leaves it right here.
 *
 * @param completed - The state being asked for, not the one the card is holding.
 */
async function stamp(completed: boolean): Promise<void> {
  // A guard rather than a disabled mark: the second press asks for the state the
  // first one is already filing, so its answer would change nothing on the board.
  if (stamping) {
    return
  }

  // Cleared first: what is on the card is about the previous attempt.
  toggleError.value = ''
  stamping = true

  try {
    await tasksStore.setTaskCompletion(props.task.id, completed)
  } catch (cause) {
    // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
    // backend is not running, which is the likeliest failure in development.
    toggleError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    stamping = false
  }
}

// [AI assisted 011] `throttle()` 寫在 `<script setup>` 裡，所以每張卡各有一個窗口。這是重點：
// 若圖方便提到模組層級共用一份，蓋掉一張單會連帶讓旁邊那張在 500ms 內按不動。
const onToggle = throttle(stamp, WRITE_THROTTLE_MS)

/**
 * The three-dot button, held so the menu can be hung from it. A ref rather than the
 * click event's `currentTarget`, which is a bare `EventTarget` and short-lived.
 */
const menuButton = useTemplateRef<HTMLButtonElement>('menuButton')

// [AI assisted 006] 面板歸卡片、關閉時不渲染，是使用者的裁示，推翻了前一版共用面板的做法。
// 沒渲染就沒有對象可呼叫，所以面板改成 props 進、事件出，開關狀態只留卡片這一份。
/** Whether this card's row menu is up, which is also whether it is rendered. */
const menuOpen = ref(false)

/**
 * Whether the press that last took the menu away landed on this very button — what
 * makes the three-dot button a switch, since the popover dismisses on `pointerdown`.
 */
let dismissedByButton = false

/** Opens the menu, unless this press is the one that has just closed it. */
function onMenuButton(): void {
  const pressedAgain = dismissedByButton

  dismissedByButton = false

  if (pressedAgain) {
    return
  }

  menuOpen.value = true
}

/**
 * Takes the menu off the card.
 *
 * @param byButton - Whether the three-dot button is what dismissed it.
 */
function onMenuClose(byButton: boolean): void {
  menuOpen.value = false
  dismissedByButton = byButton
}
</script>

<template>
  <article
    class="relative grid grid-cols-[26px_1fr] rounded-sm border border-rule shadow-[0_1px_0_rgba(31,28,24,0.18)]"
    :class="task.completed ? 'bg-stock-2' : 'bg-stock'"
  >
    <!--
      The two round punches are painted the tray's colour, so the card reads as
      pierced. They sit outside the stub's box, hence the positioning context.
    -->
    <div
      class="relative flex flex-col items-center justify-center gap-[7px] rounded-l-sm border-r border-dashed border-rule py-2 before:absolute before:-top-1 before:-right-1 before:size-[7px] before:rounded-full before:bg-tray before:content-[''] after:absolute after:-right-1 after:-bottom-1 after:size-[7px] after:rounded-full after:bg-tray after:content-['']"
      :class="[stub.paper, stub.ink]"
    >
      <!--
        Filled for bug, outlined for feature. Hidden from assistive tech: the
        number below already spells the category out.
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
      <!-- anywhere wraps an unbroken string mid-word; pr-26px clears the menu button. -->
      <p
        class="mb-2 pr-[26px] font-display text-[17px] leading-[1.3] font-medium [overflow-wrap:anywhere]"
        :class="
          task.completed ? 'text-ink-2 line-through decoration-stamp decoration-[1.5px]' : 'text-ink'
        "
      >
        <!-- [AI assisted 008] 選 stretched link 而不是在 <article> 掛 click：後者會把
             方框與三點鈕變成巢狀互動元素，兩顆都得靠 stopPropagation 補救。 -->
        <!--
          The title is the button; its ::after overlay makes the whole card the target,
          so the mark and menu stay siblings. A line-through cannot cross into it.
        -->
        <button
          type="button"
          data-open-detail
          :aria-label="`${number} ${task.title}，檢視明細`"
          class="cursor-pointer border-0 bg-transparent p-0 text-left [overflow-wrap:anywhere] after:absolute after:inset-0 after:rounded-sm after:content-[''] hover:underline hover:decoration-1 hover:underline-offset-[3px] focus-visible:outline-none focus-visible:after:-outline-offset-2 focus-visible:after:outline-2 focus-visible:after:outline-stamp"
          :class="task.completed ? 'line-through decoration-stamp decoration-[1.5px]' : undefined"
          @click="emit('detail')"
        >
          {{ task.title }}
        </button>
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <!--
          The ::before overlay grows the 24px box to a 44px hit area. 11px, not the
          spec's 10px: the overlay insets from the padding box, so the border is paid twice.
        -->
        <button
          type="button"
          :aria-pressed="task.completed"
          :aria-label="markLabel"
          class="relative z-[1] inline-flex min-h-6 cursor-pointer appearance-none items-center gap-1.5 rounded-sm border bg-transparent py-[3px] pr-[7px] pl-[5px] font-mono text-[10.5px] tracking-[0.06em] before:absolute before:-inset-x-[2px] before:-inset-y-[11px] before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
          :class="
            task.completed
              ? 'border-stamp text-stamp'
              : 'border-rule text-ink-2 hover:border-ink-2 hover:text-ink'
          "
          @click="onToggle(!task.completed)"
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
            A real element rather than the spec's CSS `content`, which assistive tech
            need not announce: overdue costs the reader something, so never colour-only.
          -->
          <span
            v-if="overdue"
            class="border border-alert px-1 text-[9.5px] font-normal tracking-[0.08em]"
          >
            逾期
          </span>
        </span>
      </div>

      <!--
        A refused stamp says so here, on the docket that stayed put. Not drawn while
        empty: a row kept for a message that is usually absent would grow every card.
        The margin on a stamped card is the strip 完成 DONE sits in — it is positioned
        against the card, and without it the reason would run under the stamp.
      -->
      <p
        v-if="toggleError"
        data-toggle-error
        role="alert"
        class="mt-2 border-l-[3px] border-alert bg-alert-bg px-2 py-[5px] text-[11.5px] leading-[1.5] text-ink-2 [overflow-wrap:anywhere]"
        :class="task.completed ? 'mb-[30px]' : undefined"
      >
        <strong class="font-display font-semibold text-alert">狀態沒改到</strong>
        —— {{ toggleError }}
      </p>
    </div>

    <!-- The card's only control besides the mark; everything else lives in the menu. -->
    <button
      ref="menuButton"
      type="button"
      :aria-label="`${number} 的操作選單`"
      aria-haspopup="true"
      class="absolute top-1 right-1 z-[1] grid size-[26px] cursor-pointer place-content-center gap-[3px] rounded-sm border-0 bg-transparent before:absolute before:-inset-[9px] before:content-[''] hover:bg-stamp-bg hover:text-stamp focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stamp"
      :class="task.completed ? 'text-ink-2' : 'text-ink-3'"
      @click="onMenuButton"
    >
      <span
        v-for="dot in 3"
        :key="dot"
        class="block size-[3px] rounded-full bg-current"
      />
    </button>

    <!--
      A popover renders in the top layer wherever it sits in the markup, so it is
      not clipped by the tray. `menuButton` is in the condition: no button, no anchor.
    -->
    <RowMenu
      v-if="menuOpen && menuButton"
      :task="task"
      :anchor="menuButton"
      @close="onMenuClose"
      @edit="emit('edit')"
      @delete="emit('delete')"
    />

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
