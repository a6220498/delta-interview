<script setup lang="ts">
/**
 * The delete confirmation: `TaskDialog`'s sheet with a red top rule and one question.
 * `role="alertdialog"`, focus on 取消, and it decides nothing — it reports and waits.
 */
import { computed, nextTick, shallowRef, useId, useTemplateRef } from 'vue'
import { displayNumber } from '@/utils/task'

import type { Task } from '@/types/task'
import type { DeleteDialogEmits, DeleteDialogExposed } from './types'



const emit = defineEmits<DeleteDialogEmits>()

/**
 * Prefix for this sheet's element ids. Generated, so two confirmations mounted at
 * once cannot have one describing the other one's warning.
 */
const uid = useId()

const deleteDialogEl = useTemplateRef<HTMLDialogElement>('deleteDialogEl')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

/**
 * The task the question is about, or `null` while nothing is being asked.
 * `shallowRef`: the sheet reads two fields off it and never writes one back.
 */
const target = shallowRef<Task | null>(null)

/** The docket's number, e.g. `bug-0012`; empty while the sheet is down. */
const number = computed(() => (target.value ? displayNumber(target.value) : ''))

/** The docket's title, copied onto the paper so the question names its subject. */
const title = computed(() => target.value?.title ?? '')

/**
 * Asks about one docket.
 *
 * @param task - The task being proposed for deletion.
 */
function open(task: Task): void {
  target.value = task

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

// [AI assisted 006] 確定不會自己關窗：刪除可能失敗（404、斷線），關窗留給呼叫端在
// DELETE 回來之後做。跟 TaskDialog 的 submit 同一條規則。
/**
 * Hands the answer up, with the docket it is about. The guard is unreachable through
 * the interface, and upholds the promise `DeleteDialogEmits` makes.
 */
function onConfirm(): void {
  const task = target.value

  if (task) {
    emit('confirm', task)
  }
}
</script>

<template>
  <!--
    m-auto restores the centring preflight zeroes; p-0 drops the UA's own padding.
    Narrower than the form sheet and red along the top: one question, not four fields.
  -->
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
      <!--
        The title copied onto the paper. anywhere rather than truncation: a title
        cut short might belong to a different docket than the one being deleted.
      -->
      <p
        data-quote
        class="border-l-[3px] border-alert bg-alert-bg px-[11px] py-[9px] font-display text-[16.5px] text-ink [overflow-wrap:anywhere]"
      >
        {{ title }}
      </p>

      <!--
        The dialog's description, so `alertdialog` reads it out on opening: what
        happens, and that it cannot be taken back.
      -->
      <p
        :id="`${uid}-warning`"
        class="text-[12.5px] text-ink-2"
      >
        單子會從架上撤掉，這個動作無法復原。
      </p>

      <!--
        The same 取消／確定 pair as every other sheet: the stakes are carried by
        the red rule and button, not by renaming 確定 to 刪除 on this one screen.
      -->
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
