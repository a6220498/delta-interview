<script setup lang="ts">
/**
 * The delete confirmation: the same sheet of paper as `TaskDialog`, with the
 * rule across its top in red and one question on it.
 *
 * Deleting sits next to editing in the row menu, the two are one keystroke
 * apart and only one of them can be undone — which is the whole reason this
 * step exists. So the paper copies out the docket's number *and* its title:
 * what is being confirmed is this one particular sheet, not a nameless "這個
 * 項目" that a person has to trust they were pointing at.
 *
 * A native `<dialog>` opened with `showModal()`, for the reasons `TaskDialog`
 * gives — focus trap, Esc, focus handed back to the control that opened it.
 * Two things here that the sheet next door does not need:
 *
 * - `role="alertdialog"`, with the warning line as the dialog's description, so
 *   the consequence is read out on opening rather than only sitting there.
 * - Focus lands on 取消. A destructive action may not be what a stray Enter
 *   hits, and Esc — which is to say, giving no answer at all — means no.
 *
 * The sheet decides nothing: it reports 確定 and waits. See `./types`.
 */
import { computed, nextTick, shallowRef, useId, useTemplateRef } from 'vue'
import { displayNumber } from '@/utils/task'

import type { Task } from '@/types/task'
import type { DeleteDialogEmits, DeleteDialogExposed } from './types'



const emit = defineEmits<DeleteDialogEmits>()

/**
 * Prefix for this sheet's element ids.
 *
 * Generated rather than written out: `aria-labelledby` and `aria-describedby`
 * are both ids, and two confirmations mounted at once with hard-coded ids would
 * have one of them describing the other one's warning.
 */
const uid = useId()

const deleteDialogEl = useTemplateRef<HTMLDialogElement>('deleteDialogEl')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

/**
 * The task the question is about, or `null` while nothing is being asked.
 *
 * `shallowRef` because the sheet only reads two fields off it and never writes
 * one back; a deep ref would turn the board's task into a reactive copy of
 * itself the moment it was handed over.
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

  // Placed by hand rather than left to the dialog's own focusing steps, which
  // would take the first focusable thing in the sheet. That is 取消 today, but
  // only by source order — a close cross added to the head later would quietly
  // take the focus, and where it sits is a stated requirement here, not a
  // consequence of the running order. Deferred a tick for the same reason the
  // element is: the button is only focusable once the sheet is actually up.
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
// DELETE 回來之後做 —— 一張已經消失的確認框會把問題連同答案一起帶走。跟 TaskDialog 的
// submit 同一條規則。
/**
 * Hands the answer up, with the docket it is about.
 *
 * The guard is unreachable through the interface — the sheet is only up because
 * `open()` put a task on it — and is here because "confirm carries a task" is
 * the promise `DeleteDialogEmits` makes, and an emit of `null` would break it
 * rather than report it.
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
    m-auto is not decoration: Tailwind's preflight zeroes every margin, which
    takes with it the `margin: auto` the browser centres a modal dialog with.
    p-0 for the same reason in reverse — the UA gives a dialog its own padding,
    and the head and the body each carry their own.

    Narrower than the form sheet (390px against 430px) and red along the top:
    one question needs less paper than four fields, and the red rule is the
    first thing that says this sheet is not the other one.
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
        The title copied out onto the paper, ruled off in red down its left
        edge. anywhere rather than a truncation: a title cut short is a title
        that might belong to a different docket than the one being deleted.
      -->
      <p
        data-quote
        class="border-l-[3px] border-alert bg-alert-bg px-[11px] py-[9px] font-display text-[16.5px] text-ink [overflow-wrap:anywhere]"
      >
        {{ title }}
      </p>

      <!--
        The dialog's description, so `alertdialog` reads it out on opening. It
        says what happens and that it cannot be taken back — the two things a
        person needs before pressing the red button, rather than after.
      -->
      <p
        :id="`${uid}-warning`"
        class="text-[12.5px] text-ink-2"
      >
        單子會從架上撤掉，這個動作無法復原。
      </p>

      <!--
        The same 取消／確定 pair as every other sheet: what is at stake is
        carried by the red rule, the red button and the line above them, not by
        renaming the button to 刪除 on this one screen.
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
