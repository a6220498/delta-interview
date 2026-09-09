<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef } from 'vue'
import { WRITE_THROTTLE_MS } from '@/const/interaction'
import { useTasksStore } from '@/stores/tasks'
import { displayNumber, throttle } from '@/utils'

import type { TaskSummary } from '@/types/task'
import type { DeleteDialogEmits, DeleteDialogExposed } from './types'



const emit = defineEmits<DeleteDialogEmits>()

const tasksStore = useTasksStore()

/**
 * Prefix for this sheet's element ids. Generated, so two confirmations mounted at
 * once cannot have one describing the other one's warning.
 */
const uid = useId()

const deleteDialogEl = useTemplateRef<HTMLDialogElement>('deleteDialogEl')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

/**
 * The task the question is about, or `null` while nothing is being asked. A row, not a
 * whole task: `shallowRef`, since the sheet reads three fields and writes none back.
 */
const target = shallowRef<TaskSummary | null>(null)

/**
 * Why the last delete came back refused, or empty while none has. Not the store's
 * `error`: that one raises the board's 工單載不出來, which sits behind this modal.
 */
const deleteError = ref('')

/** The docket's number, e.g. `bug-0012`; empty while the sheet is down. */
const number = computed(() => (target.value ? displayNumber(target.value) : ''))

/** The docket's title, copied onto the paper so the question names its subject. */
const title = computed(() => target.value?.title ?? '')

/**
 * Asks about one docket.
 *
 * @param task - The task being proposed for deletion.
 */
function open(task: TaskSummary): void {
  target.value = task
  deleteError.value = ''

  const element = deleteDialogEl.value

  if (!element) {
    return
  }

  // Guarded rather than called flat: `showModal()` on a dialog that is already
  // open throws, and moving the question onto another docket is allowed.
  if (!element.open) {
    element.showModal()
  }

  // Placed by hand: the dialog's own steps would take whatever is first in source
  // order. Deferred a tick, since the button is focusable only once the sheet is up.
  void nextTick(() => {
    cancelButton.value?.focus()
  })
}

/** Takes the question away; a no-op if it is already down. */
function close(): void {
  const element = deleteDialogEl.value

  if (element?.open) {
    element.close()
  }
}

defineExpose<DeleteDialogExposed>({ open, close })

/**
 * Whether a delete is on the wire. A plain `let`: nothing draws it, and a spinner that
 * appears and vanishes inside a frame is worse than none at all.
 */
let deleting = false

// [AI assisted 006] 確定不會馬上關窗：刪除可能失敗（404、斷線），關窗留到 DELETE
// 回來之後才做。跟 TaskDialog 的存檔同一條規則。
async function withdraw(): Promise<void> {
  const task = target.value

  // A guard rather than a disabled button: a second 確定 sends a second DELETE, and
  // the 404 it comes back with would report a delete that worked as one that failed.
  if (deleting || !task) {
    return
  }

  // Cleared first: what is on the paper is about the previous attempt.
  deleteError.value = ''
  deleting = true

  try {
    await tasksStore.deleteTask(task.id)
    close()
  } catch (cause) {
    // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
    // backend is not running, which is the likeliest failure in development.
    deleteError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    deleting = false
  }
}

// [AI assisted 011] 窗口從按下那一刻起算，不是從 DELETE 回來起算。關窗本來就要等回應，
// 若改成從回應起算，一次慢的刪除會把窗口拖到使用者早已鬆手之後，下一次真心要按的人
// 反而被擋。
const onConfirm = throttle(withdraw, WRITE_THROTTLE_MS)
</script>

<template>
  <dialog
    ref="deleteDialogEl"
    role="alertdialog"
    :aria-labelledby="`${uid}-heading`"
    :aria-describedby="`${uid}-warning`"
    class="m-auto w-[min(390px,calc(100vw-32px))] rounded-sm border border-t-[3px] border-rule border-t-alert bg-stock p-0 text-ink shadow-[0_14px_38px_rgba(31,28,24,0.34)] backdrop:bg-[rgba(31,28,24,0.44)]"
    @close="emit('close')"
  >
    <!-- Baseline alignment sits the small number on the heading's own line. -->
    <div
      class="flex items-baseline gap-2.5 border-b border-dashed border-rule px-[17px] pt-[13px] pb-[11px]"
    >
      <span
        data-number
        class="font-mono text-[10.5px] tracking-[0.12em] text-ink-3"
      >{{ number }}</span>

      <!-- Preflight strips a heading's own size and weight, so both are stated. -->
      <h2
        :id="`${uid}-heading`"
        class="font-display text-[19px] font-semibold tracking-[0.02em]"
      >
        刪除工單
      </h2>
    </div>

    <div class="grid gap-3 px-[17px] pt-[15px] pb-[17px]">
      <p
        data-quote
        class="border-l-[3px] border-alert bg-alert-bg px-[11px] py-[9px] font-display text-[16.5px] text-ink [overflow-wrap:anywhere]"
      >
        {{ title }}
      </p>

      <p
        :id="`${uid}-warning`"
        class="text-[12.5px] text-ink-2"
      >
        單子會從架上撤掉，這個動作無法復原。
      </p>

      <p
        v-if="deleteError"
        data-delete-error
        role="alert"
        class="rounded-sm border border-alert bg-alert-bg px-[11px] py-[9px]"
      >
        <strong class="block font-display text-[15px] tracking-[0.01em] text-alert">
          這張單子沒撤掉
        </strong>

        <!-- The server's own problem detail: 沒撤掉 alone gives nothing to act on. -->
        <span class="text-[12.5px] text-ink-2">{{ deleteError }}</span>
      </p>

      <div class="flex justify-end gap-[9px]">
        <button
          ref="cancelButton"
          type="button"
          data-cancel
          class="min-h-10 cursor-pointer appearance-none rounded-sm border border-rule bg-transparent px-4 font-display text-[14.5px] font-semibold tracking-[0.04em] text-ink-2 hover:border-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
          @click="close"
        >
          取消
        </button>

        <button
          type="button"
          data-confirm
          class="min-h-10 cursor-pointer appearance-none rounded-sm border border-alert bg-alert px-4 font-display text-[14.5px] font-semibold tracking-[0.04em] text-stock hover:border-alert-2 hover:bg-alert-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
          @click="onConfirm"
        >
          確定
        </button>
      </div>
    </div>
  </dialog>
</template>
