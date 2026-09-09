<script setup lang="ts">
import { computed, ref, shallowRef, useId, useTemplateRef } from 'vue'

import { getTask } from '@/api/tasks'
import type { TaskSummary } from '@/types/task'
import {
  categoryDisplay,
  displayNumber,
  formatFullDueDate,
  formatTimestamp,
  isOverdue,
} from '@/utils'

import { CATEGORY_NAMES, LABELS, MESSAGES } from './const'
import type { CardDetailDialogEmits, CardDetailDialogExposed } from './types'

const emit = defineEmits<CardDetailDialogEmits>()

/**
 * Prefix for this sheet's element ids. Generated, so two copies mounted at once
 * cannot give one heading two windows to name.
 */
const uid = useId()

const detailDialogEl = useTemplateRef<HTMLDialogElement>('detailDialogEl')

/**
 * The docket on the paper, or `null` while the sheet is down. `shallowRef`: the row is
 * read out once as the window opens, and no field on it is ever written back.
 */
const source = shallowRef<TaskSummary | null>(null)

/** Where the 說明 block is: on the wire, drawn, or refused. */
const descriptionState = ref<'loading' | 'ready' | 'failed'>('loading')

/** The description the last successful fetch returned; `null` when the docket has none. */
const description = ref<string | null>(null)

/** Why the last fetch came back refused, or empty while none has. */
const descriptionError = ref('')

const completed = computed(() => source.value?.completed ?? false)
const number = computed(() => (source.value ? displayNumber(source.value) : ''))
const title = computed(() => source.value?.title ?? '')
const stateLabel = computed(() => (completed.value ? LABELS.done : LABELS.open))
const overdue = computed(() => (source.value ? isOverdue(source.value) : false))
const dueDate = computed(() => formatFullDueDate(source.value?.dueDate))

/** The category cell's text, e.g. `bug — 修復`; the mark beside it carries the shape. */
const category = computed(() => {
  const code = source.value?.category ?? 0
  const { prefix, mark, solid } = categoryDisplay(code)

  return { mark, solid, label: `${prefix} — ${CATEGORY_NAMES[code]}` }
})

/**
 * The paper this sheet is printed on, and the ink the category mark is knocked out of
 * it in. One object, so the knockout cannot fall out of step with the paper behind it.
 */
const stock = computed(() =>
  completed.value
    ? { paper: 'bg-stock-2', rule: 'border-t-stamp', ink: 'text-stamp', knockout: 'text-stock-2' }
    : { paper: 'bg-stock', rule: 'border-t-ink', ink: 'text-ink', knockout: 'text-stock' },
)

/**
 * Which request the window is currently waiting on. Two cards pressed in a row put two
 * requests in the air, and only the one belonging to the docket on the paper may land.
 */
let ticket = 0

// [AI assisted 008] 直接呼叫 getTask 而不是 store.fetchTask：後者會把錯誤寫進
// store.error，讓看板的失敗橫幅亮在 modal 後面 —— 規格註五要求錯誤留在窗裡。
/**
 * Fetches the one field the shelf never carried and puts it in the block. A refusal is
 * printed inside the window: the board's own notice sits behind this modal, unread.
 *
 * @returns Resolves once the block reflects the attempt, successful or not.
 */
async function loadDescription(): Promise<void> {
  const task = source.value

  if (!task) {
    return
  }

  const mine = (ticket += 1)

  descriptionState.value = 'loading'
  descriptionError.value = ''

  try {
    const whole = await getTask(task.id)

    // The window has moved on — onto another docket, or off the desk entirely.
    // Writing here would put one docket's description under another's number.
    if (mine !== ticket) {
      return
    }

    // `?? null`: the contract makes `description` optional as well as nullable,
    // and the block has one shape for "no description" rather than two.
    description.value = whole.description ?? null
    descriptionState.value = 'ready'
  } catch (cause) {
    if (mine !== ticket) {
      return
    }

    // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
    // backend is not running, which is the likeliest failure in development.
    descriptionError.value = cause instanceof Error ? cause.message : String(cause)
    descriptionState.value = 'failed'
  }
}

/**
 * Pulls one docket off the shelf and reads it. Everything but the 說明 is drawn from
 * the row straight away, so the window never opens as a skeleton of itself.
 *
 * @param task - The row whose card was pressed.
 */
function open(task: TaskSummary): void {
  source.value = task
  description.value = null

  const element = detailDialogEl.value

  if (!element) {
    return
  }

  // Guarded rather than called flat: `showModal()` on a dialog that is already
  // open throws, and moving the window onto another docket is allowed.
  if (!element.open) {
    element.showModal()
  }

  // Focus lands on the window itself, not on 關閉: this is a page to read, and
  // focusing the one button would open it with the reader standing at the exit.
  element.focus()

  void loadDescription()
}

/** Files the copy back; a no-op if it is already down. */
function close(): void {
  const element = detailDialogEl.value

  if (element?.open) {
    element.close()
  }
}

defineExpose<CardDetailDialogExposed>({ open, close })

// [AI assisted 008] 這個 if 是瀏覽器實測抓出來的，不是預想：close 事件排進佇列而非
// 同步派送，少了它，同一輪關窗再開卡片時說明區會永遠停在載入中。
/** Reports the window going down and invalidates whatever it was still waiting on. */
function onClose(): void {
  // A browser queues `close` rather than dispatching it inline, so a card pressed in
  // the same turn as 關閉 is already open here — cancelling would drop its request.
  if (!detailDialogEl.value?.open) {
    ticket += 1
  }

  emit('close')
}
</script>

<template>
  <dialog
    ref="detailDialogEl"
    tabindex="-1"
    :aria-labelledby="`${uid}-heading`"
    class="m-auto max-h-[calc(100dvh-64px)] w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-sm border border-t-[3px] border-rule p-0 text-ink shadow-[0_14px_38px_rgba(31,28,24,0.34)] backdrop:bg-[rgba(31,28,24,0.44)] open:grid open:grid-rows-[auto_minmax(0,1fr)_auto]"
    :class="[stock.paper, stock.rule]"
    @close="onClose"
  >
    <div
      class="flex items-center gap-2.5 border-b border-dashed border-rule px-[17px] pt-[13px] pb-[11px]"
    >
      <span
        data-category
        aria-hidden="true"
        class="grid size-[15px] flex-none place-items-center rounded-sm border-[1.5px] border-current font-mono text-[9px] leading-none font-bold"
        :class="[stock.ink, { 'bg-current': category.solid }]"
      >
        <span :class="category.solid ? stock.knockout : undefined">{{ category.mark }}</span>
      </span>

      <span
        data-number
        class="font-mono text-[10.5px] tracking-[0.12em] text-ink-3"
      >{{ number }}</span>

      <h2
        :id="`${uid}-heading`"
        class="font-display text-[19px] font-semibold tracking-[0.02em]"
      >
        工單明細
      </h2>

      <span
        v-if="completed"
        data-chop
        aria-hidden="true"
        class="ml-auto rotate-[-3deg] rounded-sm border-2 border-stamp px-1.5 py-px font-display text-[12px] font-bold tracking-[0.14em] text-stamp opacity-55"
      >
        完成 DONE
      </span>
    </div>

    <div class="grid content-start gap-[14px] overflow-auto px-[17px] pt-[15px] pb-[17px]">
      <!-- title -->
      <p
        data-title
        class="font-display text-[22px] leading-[1.25] font-medium [overflow-wrap:anywhere]"
        :class="
          completed ? 'text-ink-2 line-through decoration-stamp decoration-[1.5px]' : 'text-ink'
        "
      >
        {{ title }}
      </p>

      <div
        class="flex flex-wrap gap-px rounded-sm border border-rule bg-rule max-[700px]:[&>div]:flex max-[700px]:[&>div]:flex-wrap max-[700px]:[&>div]:items-baseline max-[700px]:[&>div]:gap-x-2 max-[700px]:[&>div]:gap-y-[3px]"
      >
        <div
          data-fact="state"
          class="grid min-w-0 flex-[1_1_128px] gap-[5px] px-[11px] pt-2 pb-[9px]"
          :class="stock.paper"
        >
          <span class="font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">狀態</span>

          <span
            class="inline-flex items-center gap-[7px] font-display text-[15px] text-ink max-[700px]:text-[14px]"
          >
            <span
              aria-hidden="true"
              class="grid size-3 flex-none place-items-center border-[1.5px] text-[10px] leading-none"
              :class="
                completed ? 'border-stamp bg-stamp text-stock' : 'border-ink-3 text-transparent'
              "
            >
              ✓
            </span>
            {{ stateLabel }}
          </span>
        </div>

        <div
          data-fact="due-date"
          class="grid min-w-0 flex-[1_1_128px] gap-[5px] px-[11px] pt-2 pb-[9px]"
          :class="stock.paper"
        >
          <span class="font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">到期日</span>

          <span
            class="inline-flex items-center gap-[7px] font-display text-[15px] max-[700px]:text-[14px]"
          >
            <span
              class="font-mono text-[13.5px] tabular-nums max-[700px]:text-[12.5px]"
              :class="overdue ? 'text-alert' : 'text-ink-2'"
            >
              {{ dueDate }}
            </span>

            <span
              v-if="overdue"
              class="border border-alert px-1 font-mono text-[9.5px] tracking-[0.08em] text-alert"
            >
              逾期
            </span>
          </span>
        </div>

        <div
          data-fact="category"
          class="grid min-w-0 flex-[1_1_128px] gap-[5px] px-[11px] pt-2 pb-[9px]"
          :class="stock.paper"
        >
          <span class="font-mono text-[9.5px] tracking-[0.12em] text-ink-3 uppercase">類別</span>

          <span
            class="inline-flex items-center gap-[7px] font-display text-[15px] text-ink max-[700px]:text-[14px]"
          >
            <span
              aria-hidden="true"
              class="grid size-[15px] flex-none place-items-center rounded-sm border-[1.5px] border-current font-mono text-[9px] leading-none font-bold"
              :class="[stock.ink, { 'bg-current': category.solid }]"
            >
              <span :class="category.solid ? stock.knockout : undefined">{{ category.mark }}</span>
            </span>
            {{ category.label }}
          </span>
        </div>
      </div>

      <div>
        <div
          class="mb-2 flex items-center gap-[9px] font-mono text-[11px] font-bold tracking-[0.12em] text-ink-2 uppercase after:flex-1 after:border-t after:border-rule after:content-['']"
        >
          說明
        </div>

        <div
          data-description
          :aria-busy="descriptionState === 'loading'"
        >
          <template v-if="descriptionState === 'loading'">
            <div
              aria-hidden="true"
              class="h-[11px] w-[70%] rounded-[1px] bg-rule-2"
            />
            <div
              aria-hidden="true"
              class="mt-[7px] h-[11px] w-[45%] rounded-[1px] bg-rule-2"
            />
            <div
              aria-hidden="true"
              class="mt-[7px] h-[11px] w-[60%] rounded-[1px] bg-rule-2"
            />
          </template>

          <p
            v-else-if="descriptionState === 'ready'"
            data-description-text
            class="leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere]"
            :class="description ? 'text-[15px] text-ink' : 'text-[13.5px] text-ink-3 italic'"
          >
            {{ description || MESSAGES.noDescription }}
          </p>

          <div
            v-else
            data-description-error
            role="alert"
            class="rounded-sm border border-alert bg-alert-bg px-[11px] py-[9px]"
          >
            <strong class="block font-display text-[15px] tracking-[0.01em] text-alert">
              {{ MESSAGES.failed }}
            </strong>

            <!-- How much of the window still holds, then the server's own reason. -->
            <span class="text-[12.5px] text-ink-2">
              {{ MESSAGES.failedScope }} —— {{ descriptionError }}
            </span>

            <button
              type="button"
              data-retry
              class="mt-1.5 block min-h-[28px] cursor-pointer appearance-none rounded-sm border border-alert bg-transparent px-[9px] py-1 font-mono text-[10.5px] tracking-[0.06em] text-alert hover:border-alert-2 hover:text-alert-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
              @click="loadDescription"
            >
              重試
            </button>
          </div>
        </div>

        <p
          data-description-status
          role="status"
          class="mt-[9px] font-mono text-[11px] tracking-[0.06em] text-ink-3"
        >
          {{ descriptionState === 'loading' ? MESSAGES.loading : '' }}
        </p>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-rule px-[17px] pt-[11px] pb-[13px]"
    >
      <!-- The only screen either timestamp appears on. -->
      <div
        class="grid gap-0.5 font-mono text-[11px] tracking-[0.04em] tabular-nums text-ink-3"
      >
        <span>開單 <b
          data-created
          class="font-normal text-ink-2"
        >{{ source ? formatTimestamp(source.createdAt) : '—' }}</b></span>
        <span>異動 <b
          data-updated
          class="font-normal text-ink-2"
        >{{ source ? formatTimestamp(source.updatedAt) : '—' }}</b></span>
      </div>

      <button
        type="button"
        data-close
        class="min-h-10 cursor-pointer appearance-none rounded-sm border border-rule bg-transparent px-4 font-display text-[14.5px] font-semibold tracking-[0.04em] text-ink-2 hover:border-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
        @click="close"
      >
        關閉
      </button>
    </div>
  </dialog>
</template>
