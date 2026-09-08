<script setup lang="ts">
/**
 * The sheet: one blank docket, filled in either to open a new job or to correct
 * a filed one.
 *
 * Deliberately one component for both, as the spec has it. The two differ in
 * four words — the number in the corner and the heading beside it — while the
 * fields, their limits, their validation and the 取消／確定 pair are identical;
 * a second component would be a copy of this one that drifts the first time a
 * field is added to only one of them. `open()` carries the difference, and in
 * edit mode the task it is handed carries the values the fields open with.
 *
 * A native `<dialog>` opened with `showModal()`, not a floating div: focus stays
 * inside the sheet, Esc closes it, and focus returns to the control that opened
 * it — all things the browser already does correctly and a hand-built modal has
 * to earn back one keyboard interaction at a time.
 *
 * Opened and closed by calling it rather than by a prop, because the browser
 * closes it too and a fact with two owners goes out of step: see
 * `TaskDialogExposed` in `./types`. What the sheet does *not* decide is what
 * becomes of what was typed — it reports that and waits: see `submit`.
 */
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef } from 'vue'

import type { Task, TaskCategory } from '@/types/task'
import { categoryDisplay, displayNumber } from '@/utils/task'

import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  FIELD_LIMITS,
  HEADINGS,
  MESSAGES,
  NEW_NUMBER,
} from './const'
import type { TaskDialogEmits, TaskDialogExposed, TaskDialogMode, TaskDialogOpen } from './types'

// [AI assisted 006] 這個元件一個 prop 都沒有，是使用者要求改用 defineExpose 的
// open / close 之後的連帶決定：原本的 `open` 布林 prop 會變成第二個「彈窗開著沒有」的
// 主人，而瀏覽器自己就會關 dialog（Esc、backdrop），父層那份遲早跟元素本身不同步。
// 唯一事實來源改成 <dialog> 的 open 屬性，showModal() 前也因此要擋一次 —— 對已開啟的
// dialog 呼叫會丟 InvalidStateError，而「開著時換成另一張單」是合理操作。
const emit = defineEmits<TaskDialogEmits>()

/**
 * Prefix for this sheet's element ids.
 *
 * Generated rather than written out, because every `for` / `aria-describedby`
 * pair below is an id: two sheets mounted at once with hard-coded ids would
 * give one label two inputs to point at, and a label that points at the wrong
 * field is worse than no label at all.
 */
const uid = useId()

const taskDialogEl = useTemplateRef<HTMLDialogElement>('taskDialogEl')
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')

/** Which of the two jobs this sheet is currently doing. */
const mode = ref<TaskDialogMode>('create')

/**
 * The task the sheet was opened on, or `null` while it is a blank one.
 *
 * `shallowRef` because the sheet holds a task, it does not own one: it takes
 * the values out once, as it opens, and never writes a field back through it —
 * and a deep ref would make the board's task into a reactive copy of itself the
 * moment it was handed over.
 */
const source = shallowRef<Task | null>(null)

const title = ref('')
const category = ref<TaskCategory>(DEFAULT_CATEGORY)
const description = ref('')
const dueDate = ref('')
const titleError = ref('')

const heading = computed(() => HEADINGS[mode.value])

/** The number in the corner: the task's own, or `NEW` while it has none. */
const number = computed(() => (source.value ? displayNumber(source.value) : NEW_NUMBER))

/**
 * The select's options, each drawn as `bug — 修復`.
 *
 * The prefix is taken from the same lookup that numbers a card rather than
 * written beside the gloss, so the two cannot come to disagree.
 */
const categories = computed(() =>
  CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: `${categoryDisplay(option.value).prefix} — ${option.name}`,
  })),
)

/**
 * Fills the fields from the task the sheet is opening on, or empties them.
 *
 * `??` rather than `||` on the two optional fields: the contract sends `null`
 * for "not set", and both have to land in the DOM as an empty string — a `null`
 * assigned to an input's value renders the four characters `null`.
 */
function seed(): void {
  const task = source.value

  title.value = task?.title ?? ''
  category.value = task?.category ?? DEFAULT_CATEGORY
  description.value = task?.description ?? ''
  dueDate.value = task?.dueDate ?? ''
  titleError.value = ''
}

/**
 * Puts the sheet on the desk, on a task or on nothing.
 *
 * The values are read here, as the sheet opens, and not again: the owner
 * updates the task it holds as soon as a save lands, and re-reading on that
 * would wipe out whatever had been typed since.
 *
 * @param nextMode - Which job the sheet is opening for.
 * @param task - The task to correct; only ever passed in edit mode, which the
 *   overload in `./types` is what actually enforces.
 */
const open: TaskDialogOpen = (nextMode: TaskDialogMode, task?: Task): void => {
  mode.value = nextMode
  source.value = task ?? null
  seed()

  const element = taskDialogEl.value

  if (!element) {
    return
  }

  // Guarded rather than called flat: `showModal()` on a dialog that is already
  // open throws, and moving an open sheet onto another task is allowed.
  if (!element.open) {
    element.showModal()
  }

  // Deferred to after the fields have been written. The spec's own behaviour is
  // that the caret starts in 標題 with the old title selected, so it can be
  // replaced by typing over it — and run now, `select()` would take the title
  // the box held a render ago, or nothing at all on a sheet opening for the
  // first time.
  void nextTick(() => {
    titleInput.value?.focus()
    titleInput.value?.select()
  })
}

/** Takes the sheet away; a no-op if it is already down. */
function close(): void {
  const element = taskDialogEl.value

  if (element?.open) {
    element.close()
  }
}

defineExpose<TaskDialogExposed>({ open, close })

/**
 * Validates the one required field and hands the values up.
 *
 * The title is checked here rather than left to `required`, so the message
 * lands in the row kept for it under the field instead of in a browser bubble
 * that is styled by no one, disappears on its own and is not reliably announced.
 *
 * An empty description or date is sent as `null`, not as `''`: both requests
 * replace the whole task, so an empty string would file a task whose deadline
 * is the empty string rather than one with no deadline.
 */
function onSubmit(): void {
  const trimmed = title.value.trim()

  if (!trimmed) {
    titleError.value = MESSAGES.titleRequired
    titleInput.value?.focus()
    return
  }

  titleError.value = ''

  emit('submit', {
    title: trimmed,
    description: description.value.trim() || null,
    category: category.value,
    dueDate: dueDate.value || null,
  })
}
</script>

<template>
  <!--
    m-auto is not decoration: Tailwind's preflight zeroes every margin, which
    takes with it the `margin: auto` the browser centres a modal dialog with.

    p-0 for the same reason in reverse — the UA gives a dialog its own padding,
    and the head and the form each carry their own.
  -->
  <dialog
    ref="taskDialogEl"
    :aria-labelledby="`${uid}-heading`"
    class="m-auto w-[min(430px,calc(100vw-32px))] rounded-sm border border-t-[3px] border-rule border-t-ink bg-stock p-0 text-ink shadow-[0_14px_38px_rgba(31,28,24,0.34)] backdrop:bg-[rgba(31,28,24,0.44)]"
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
        {{ heading }}
      </h2>
    </div>

    <!--
      novalidate hands validation to `onSubmit`, which puts its message in the
      row below the field rather than in a browser bubble.
    -->
    <form
      novalidate
      class="grid gap-[15px] px-[17px] pt-[15px] pb-[17px]"
      @submit.prevent="onSubmit"
    >
      <div
        data-field="title"
        class="grid gap-1"
      >
        <label
          :for="`${uid}-title`"
          class="font-mono text-[12.5px] font-bold tracking-[0.12em] text-ink-2 uppercase"
        >
          標題<!--
            The star is a mark for people who can see the form; `required` on the
            input is what carries the meaning, so a reader hears "必填" rather
            than a lone "asterisk".
          --><span
            aria-hidden="true"
            class="ml-[3px] text-[14px] text-alert"
          >*</span>
        </label>

        <!--
          A field is a line to write on, not a rounded box. The whole line turns
          red when validation fails — a red message beside a black line reads as
          a note about the form rather than about this field.

          The focus treatment is bound alongside it — both the line and the
          weight under it — rather than left as a standing purple, which would
          win over the red the moment the field took focus. Failing validation
          puts the caret right here, so that is exactly when the red would go;
          and a red line over a purple underline reads as one two-tone line
          rather than as a field in one state.
        -->
        <input
          :id="`${uid}-title`"
          ref="titleInput"
          v-model="title"
          type="text"
          required
          autocomplete="off"
          :maxlength="FIELD_LIMITS.title"
          placeholder="一句話說清楚要做什麼"
          :aria-describedby="`${uid}-title-msg`"
          class="min-h-10 w-full appearance-none rounded-none border-b-[1.5px] bg-transparent px-0.5 py-1.5 font-display text-[16.5px] text-ink placeholder:text-[14px] placeholder:italic placeholder:text-ink-3 placeholder:opacity-70 focus:outline-none"
          :class="
            titleError
              ? 'border-b-alert focus:border-b-alert focus:shadow-[0_1.5px_0_var(--color-alert)]'
              : 'border-b-ink focus:border-b-stamp focus:shadow-[0_1.5px_0_var(--color-stamp)]'
          "
          @input="titleError = ''"
        >

        <!--
          The row is empty most of the time but never collapses: it holds its
          height so a message appearing does not push the rest of the form down
          and take the reader's place on it with it. aria-live announces the
          message without interrupting someone who is still typing.
        -->
        <span
          :id="`${uid}-title-msg`"
          aria-live="polite"
          class="min-h-[17px] text-[11.5px] leading-[1.45]"
          :class="titleError ? 'text-alert' : 'text-ink-3'"
        >
          {{ titleError }}
        </span>
      </div>

      <div
        data-field="category"
        class="grid gap-1"
      >
        <label
          :for="`${uid}-category`"
          class="font-mono text-[12.5px] font-bold tracking-[0.12em] text-ink-2 uppercase"
        >
          類別<span
            aria-hidden="true"
            class="ml-[3px] text-[14px] text-alert"
          >*</span>
        </label>

        <!--
          appearance-none takes the native arrow away along with the box, so the
          wrapper draws one back — without it this field is indistinguishable
          from the single-line input above it.
        -->
        <span
          class="relative block after:pointer-events-none after:absolute after:top-[44%] after:right-[5px] after:size-[7px] after:-translate-y-1/2 after:rotate-45 after:border-r-[1.5px] after:border-b-[1.5px] after:border-ink-2 after:content-['']"
        >
          <select
            :id="`${uid}-category`"
            v-model="category"
            required
            :aria-describedby="`${uid}-category-msg`"
            class="min-h-10 w-full cursor-pointer appearance-none rounded-none border-b-[1.5px] border-b-ink bg-transparent py-1.5 pr-[22px] pl-0.5 font-display text-[16.5px] text-ink focus:border-b-stamp focus:shadow-[0_1.5px_0_var(--color-stamp)] focus:outline-none"
          >
            <option
              v-for="option in categories"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </span>

        <span
          :id="`${uid}-category-msg`"
          aria-live="polite"
          class="min-h-[17px] text-[11.5px] leading-[1.45] text-ink-3"
        />
      </div>

      <div
        data-field="description"
        class="grid gap-1"
      >
        <label
          :for="`${uid}-description`"
          class="font-mono text-[12.5px] font-bold tracking-[0.12em] text-ink-2 uppercase"
        >
          說明
        </label>

        <!--
          Ruled paper rather than a single line: the shape of the field is what
          says this one may run long, so the form does not have to say it in
          words. The rules are a repeating gradient on the line height, and
          background-attachment:local scrolls them with the text — fixed, the
          words would come off the lines on the second screenful.
        -->
        <textarea
          :id="`${uid}-description`"
          v-model="description"
          rows="3"
          :maxlength="FIELD_LIMITS.description"
          placeholder="細節、重現步驟、怎樣算做完"
          :aria-describedby="`${uid}-description-msg`"
          class="min-h-[82px] w-full resize-y appearance-none rounded-none border-b-[1.5px] border-b-ink bg-transparent px-0.5 py-0 font-display text-[16.5px] leading-[26px] text-ink [background-attachment:local] [background-image:repeating-linear-gradient(to_bottom,transparent_0_25px,var(--color-rule-2)_25px_26px)] placeholder:text-[14px] placeholder:italic placeholder:text-ink-3 placeholder:opacity-70 focus:border-b-stamp focus:shadow-[0_1.5px_0_var(--color-stamp)] focus:outline-none"
        />

        <span
          :id="`${uid}-description-msg`"
          aria-live="polite"
          class="min-h-[17px] text-[11.5px] leading-[1.45] text-ink-3"
        />
      </div>

      <div
        data-field="due-date"
        class="grid gap-1"
      >
        <label
          :for="`${uid}-due-date`"
          class="font-mono text-[12.5px] font-bold tracking-[0.12em] text-ink-2 uppercase"
        >
          到期日
        </label>

        <input
          :id="`${uid}-due-date`"
          v-model="dueDate"
          type="date"
          :aria-describedby="`${uid}-due-date-msg`"
          class="min-h-10 w-full appearance-none rounded-none border-b-[1.5px] border-b-ink bg-transparent px-0.5 py-1.5 font-display text-[16.5px] text-ink focus:border-b-stamp focus:shadow-[0_1.5px_0_var(--color-stamp)] focus:outline-none"
        >

        <span
          :id="`${uid}-due-date-msg`"
          aria-live="polite"
          class="min-h-[17px] text-[11.5px] leading-[1.45] text-ink-3"
        />
      </div>

      <!--
        The same 取消／確定 pair in both modes: what the sheet is doing is said
        once, in the heading, rather than repeated on the button.
      -->
      <div class="flex justify-end gap-[9px]">
        <button
          type="button"
          class="min-h-10 cursor-pointer appearance-none rounded-sm border border-rule bg-transparent px-4 font-display text-[14.5px] font-semibold tracking-[0.04em] text-ink-2 hover:border-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
          @click="close"
        >
          取消
        </button>

        <button
          type="submit"
          class="min-h-10 cursor-pointer appearance-none rounded-sm border border-ink bg-ink px-4 font-display text-[14.5px] font-semibold tracking-[0.04em] text-stock hover:border-stamp hover:bg-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
        >
          確定
        </button>
      </div>
    </form>
  </dialog>
</template>
