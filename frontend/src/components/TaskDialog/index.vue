<script setup lang="ts">
/**
 * The sheet: one blank docket, filled in to open a new job or correct a filed one.
 * One component for both, a native `<dialog>`, opened by calling it rather than by a prop.
 */
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef } from 'vue'

import { useTasksStore } from '@/stores/tasks'
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
import type {
  TaskDialogEmits,
  TaskDialogExposed,
  TaskDialogMode,
  TaskDialogOpen,
  TaskDialogValues,
} from './types'

// [AI assisted 006] 這個元件一個 prop 都沒有：`open` 布林 prop 會變成第二個「彈窗開著
// 沒有」的主人，而瀏覽器自己就會關 dialog，遲早不同步。唯一事實來源是 <dialog>.open。
const emit = defineEmits<TaskDialogEmits>()

/**
 * The tasks, and the two requests that file one. The store rather than an event to
 * the board: only the sheet knows which docket it is on.
 */
const tasksStore = useTasksStore()

/**
 * Prefix for this sheet's element ids. Generated, so two sheets mounted at once
 * cannot give one label two inputs to point at.
 */
const uid = useId()

const taskDialogEl = useTemplateRef<HTMLDialogElement>('taskDialogEl')
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')

/** Which of the two jobs this sheet is currently doing. */
const mode = ref<TaskDialogMode>('create')

/**
 * The task the sheet was opened on, or `null` while it is a blank one. `shallowRef`:
 * the values come out once, as it opens, and no field is ever written back.
 */
const source = shallowRef<Task | null>(null)

const title = ref('')
const category = ref<TaskCategory>(DEFAULT_CATEGORY)
const description = ref('')
const dueDate = ref('')
const titleError = ref('')

/**
 * Why the last save came back refused, or empty while none has. Not the store's
 * `error`, which is the board's and sits behind this modal anyway.
 */
const submitError = ref('')

const heading = computed(() => HEADINGS[mode.value])

/** The number in the corner: the task's own, or `NEW` while it has none. */
const number = computed(() => (source.value ? displayNumber(source.value) : NEW_NUMBER))

/**
 * The select's options, each drawn as `bug — 修復`. The prefix comes from the same
 * lookup that numbers a card, so the two cannot come to disagree.
 */
const categories = computed(() =>
  CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: `${categoryDisplay(option.value).prefix} — ${option.name}`,
  })),
)

/**
 * Fills the fields from the task the sheet is opening on, or empties them. `??` not
 * `||`: the contract's `null` must land in the DOM as an empty string.
 */
function seed(): void {
  const task = source.value

  title.value = task?.title ?? ''
  category.value = task?.category ?? DEFAULT_CATEGORY
  description.value = task?.description ?? ''
  dueDate.value = task?.dueDate ?? ''
  titleError.value = ''
  submitError.value = ''
}

/**
 * Puts the sheet on the desk, on a task or on nothing. The values are read here and
 * not again, so a save landing elsewhere cannot wipe out what has been typed since.
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

  // Deferred until the fields are written: the caret starts in 標題 with the old
  // title selected, and run now `select()` would take the box's previous contents.
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
 * Whether a save is on the wire. A plain `let`: nothing draws it, and a spinner
 * that appears and vanishes within a frame is worse than none.
 */
let saving = false

/**
 * Validates the one required field, then files what is on the sheet — a `PUT` when it
 * was opened on a docket, a `POST` otherwise. It comes down only once the save lands.
 */
async function onSubmit(): Promise<void> {
  // A guard rather than a disabled button: 確定 pressed twice on a slow connection
  // would file the same docket twice, and the copy can only be taken back by deleting it.
  if (saving) {
    return
  }

  // Cleared first: what is on the paper is about the previous attempt.
  submitError.value = ''

  const trimmed = title.value.trim()

  if (!trimmed) {
    titleError.value = MESSAGES.titleRequired
    titleInput.value?.focus()
    return
  }

  titleError.value = ''

  const values: TaskDialogValues = {
    title: trimmed,
    description: description.value.trim() || null,
    category: category.value,
    dueDate: dueDate.value || null,
  }

  saving = true

  try {
    const task = source.value

    if (task) {
      await tasksStore.updateTask(task.id, values)
    } else {
      await tasksStore.createTask(values)
    }

    close()
  } catch (cause) {
    // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
    // backend is not running, which is the likeliest failure in development.
    submitError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    saving = false
  }
}
</script>

<template>
  <!--
    m-auto restores the centring preflight zeroes; p-0 drops the UA's own padding,
    since the head and the form each carry theirs.
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
            The star is for people who can see the form; `required` on the input
            carries the meaning, so a reader hears "必填", not "asterisk".
          --><span
            aria-hidden="true"
            class="ml-[3px] text-[14px] text-alert"
          >*</span>
        </label>

        <!--
          A line to write on, not a rounded box; the whole line reddens on failure.
          Focus is bound alongside it, so a standing purple cannot win over the red.
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
          Holds its height while empty, so a message appearing cannot push the form
          down. aria-live announces it without interrupting someone still typing.
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
          appearance-none takes the native arrow away with the box, so the wrapper
          draws one back; without it this reads as the input above.
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
          Ruled paper rather than a single line, so the shape says this one may run
          long. background-attachment:local scrolls the rules with the text.
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
        A refused save says so here, not on the board behind this modal. The one row
        that does not hold its height while empty: only the buttons sit below it.
      -->
      <p
        v-if="submitError"
        data-submit-error
        role="alert"
        class="rounded-sm border border-alert bg-alert-bg px-[11px] py-[9px]"
      >
        <strong class="block font-display text-[15px] tracking-[0.01em] text-alert">
          {{ MESSAGES.saveFailed }}
        </strong>

        <!-- The server's own problem detail: 沒存進去 alone gives nothing to act on. -->
        <span class="text-[12.5px] text-ink-2">{{ submitError }}</span>
      </p>

      <!-- The same 取消／確定 pair in both modes: the heading already says which job. -->
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
