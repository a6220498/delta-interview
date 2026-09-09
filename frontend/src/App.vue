<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, useTemplateRef } from 'vue'

import DeleteDialog from '@/components/DeleteDialog/index.vue'
import type { DeleteDialogExposed } from '@/components/DeleteDialog/types'
import Header from '@/components/Header/index.vue'
import LoadFailure from '@/components/LoadFailure/index.vue'
import TaskDialog from '@/components/TaskDialog/index.vue'
import type { TaskDialogExposed } from '@/components/TaskDialog/types'
import TaskList from '@/components/TaskList/index.vue'
import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import MainLayout from '@/layouts/MainLayout/index.vue'
import { useTasksStore } from '@/stores/tasks'
import type { TaskSummary } from '@/types/task'

/**
 * The board's tasks, and how the load that fetched them went.
 *
 * The store rather than a local ref, because the list is not the board's
 * private business: the sheet, the confirmation and the completion stamp all
 * write to the same tasks, and handing an array plus a set of mutators down
 * through the trays is how two components end up disagreeing about what is on
 * the shelf.
 *
 * `storeToRefs` rather than reading `tasksStore.taskList` in the template: it
 * keeps the reactivity that plain destructuring would drop, without the board
 * having to name the store on every line.
 *
 * The trays' `toggle` and `delete` are still unhandled — each of those is its
 * own step. The board fills its shelves and raises the sheet; what is typed on
 * the sheet is filed by the sheet, through this same store.
 */
const tasksStore = useTasksStore()
const { taskList, loading, error } = storeToRefs(tasksStore)

/**
 * Fills the board on first paint.
 *
 * In `onMounted` rather than at setup time so the request is made once, by the
 * browser, rather than also on a server render. Nothing awaits it and nothing
 * catches it on purpose: the store records a failure in `error` instead of
 * throwing, and the notice below is what the reader gets.
 */
onMounted(() => {
  void tasksStore.fetchTasks()
})

/**
 * Runs the load again, behind the failure notice's 重試.
 *
 * Its own function rather than `@click="tasksStore.fetchTasks"`: handed the
 * action by name, the click's `MouseEvent` would arrive where the filter goes.
 *
 * @returns Nothing; the outcome lands in the store, not here.
 */
function reload(): void {
  void tasksStore.fetchTasks()
}

/**
 * The tasks belonging on one shelf.
 *
 * The rule is the rack's own `completed`, matched against the task's, so the
 * board never names a shelf: a rack added to the table is filed correctly here
 * without this function being touched. It also keeps the decision single —
 * a task matches exactly one rack, so it cannot land on both or on neither.
 *
 * @param rack - The shelf being drawn.
 * @returns The tasks in that completion state, in board order.
 */
function tasksFor(rack: TaskRack): TaskSummary[] {
  return taskList.value.filter((task) => task.completed === rack.completed)
}

/**
 * The sheet itself, rather than a pair of refs describing one.
 *
 * The board used to hold whether the sheet was up and which task it was up on,
 * and hand both down as props. Both facts belong to the sheet — the browser can
 * close a `<dialog>` on its own, so a flag out here was only ever the board's
 * opinion of what the sheet was doing — and asking for it by name is what keeps
 * the mode and its task together: `open('edit', …)` does not compile without
 * one, so a blank sheet cannot be opened carrying the last task edited.
 *
 * Raising it is all the board does with it. What is typed on the sheet is filed
 * by the sheet: it is the one that knows which docket it is on, and a board
 * saving on its behalf would have to keep a second copy of that fact to address
 * the request with — which is one owner too many for it.
 */
const taskDialogEl = useTemplateRef<TaskDialogExposed>('taskDialogEl')

/** Opens a blank sheet, on no task: what is filed from it will be a new one. */
function openCreate(): void {
  taskDialogEl.value?.open('create')
}

/**
 * Opens the sheet on an existing task, with its current values in the fields.
 *
 * Wired to the row menu's 編輯, which is the only entrance to it: the card's
 * three-dot button opens the panel, and the panel is what says which of its two
 * entries was chosen. The tray attaches the row on the way up, so the board
 * never works out which docket was pressed.
 *
 * The row is not enough to open the sheet on. The list endpoint answers without
 * `description`, so the whole task is fetched first — a sheet opened on the row
 * alone would show an empty 說明 and save that emptiness over detail its reader
 * was never shown.
 *
 * Nothing is drawn while that request runs, and nothing else is disabled: it is
 * one small task from a server that has already answered once, and a spinner
 * that appears and vanishes within a frame is worse than none. A second press
 * simply opens the sheet twice on the same task.
 *
 * @param task - The row whose docket was asked about.
 * @returns Resolves once the sheet is up, or once the store has recorded why
 *   it is not.
 */
async function openEdit(task: TaskSummary): Promise<void> {
  const detail = await tasksStore.fetchTask(task.id)

  // Guarded rather than opened regardless: a failed fetch hands back nothing,
  // and the notice above says why — an empty sheet would say nothing at all.
  if (detail) {
    taskDialogEl.value?.open('edit', detail)
  }
}

/**
 * The confirmation, held the same way as the sheet above.
 *
 * A second element rather than a mode on the first: the two ask for different
 * things — one is a form that can be filled in wrongly, the other is a question
 * with two answers — and merging them would mean a sheet whose fields, whose
 * heading colour and whose buttons all depend on which of the two it currently
 * is. They share the paper, not the component.
 *
 * Held but not yet raised. The row menu now exists and its 刪除 entry reports
 * as it should, but the board deliberately does not listen for it yet: this is
 * the step that builds the panel, not the one that deletes.
 * `deleteDialogEl.value?.open(task)` is what that entry will reach, in the step
 * that also has somewhere to delete the task from — left unwritten rather than
 * written and unreachable, so the board carries no line nothing can run.
 */
const deleteDialogEl = useTemplateRef<DeleteDialogExposed>('deleteDialogEl')

/**
 * Closes an answered confirmation, and nothing else — for now.
 *
 * Removing the task is the same step as the store above, so the task the
 * confirmation hands up is dropped here rather than spliced out of the local
 * array: there is no source to delete it from yet, and a board that forgot a
 * task the server still holds would put it back on the next load. The
 * confirmation waits to be closed rather than closing itself precisely so that
 * this line can move below a `DELETE` that might fail.
 */
function onConfirmDelete(): void {
  deleteDialogEl.value?.close()
}
</script>

<template>
  <MainLayout @action="openCreate">
    <template #header>
      <Header />
    </template>

    <!--
      The spec's board: two equal columns that become one below 880px, where a
      pair of trays no longer has the width to hold a docket's stub and title
      side by side. items-start lets a short tray keep its own height instead
      of stretching to match the taller one beside it.

      The trays' `delete` is left unhandled next to their `toggle`, for the same
      reason: the confirmation below is what it will reach, and that is the next
      step rather than this one.
    -->
    <!--
      The failure notice sits above the shelves rather than replacing them: a
      refresh that fails leaves the last good board on screen, and clearing it
      would hide work the server still holds.

      The gap below it is set here rather than inside the notice, because where
      it sits relative to the racks is the board's arrangement and not the
      notice's; the class falls through onto its root.
    -->
    <LoadFailure
      v-if="error"
      :reason="error"
      class="mb-[14px]"
      @retry="reload"
    />

    <div class="grid grid-cols-2 items-start gap-[14px] max-[880px]:grid-cols-1">
      <TaskList
        v-for="rack in TASK_RACKS"
        :key="rack.id"
        :rack="rack"
        :tasks="tasksFor(rack)"
        :loading="loading"
        @edit="openEdit"
      />
    </div>
  </MainLayout>

  <!--
    One sheet for both jobs, opened by name: the board calls `open('create')` or
    `open('edit', task)` on it and never says whether it is up. Written as a
    prop-driven pair it took two elements, because the type checker can only
    hold "an edit sheet carries a task" if the mode is written out — a call site
    keeps that guarantee in one line, and there is no second element left to
    fall out of step with the first.

    It sits outside `MainLayout` because a modal dialog renders in the browser's
    top layer regardless of where it is written, and nesting it inside <main>
    would only put a dialog in the content landmark's accessibility tree.

    Left mounted while closed, so the browser can hand focus back to whichever
    control opened the sheet — that is `<dialog>`'s to do, and it can only do it
    while the element is still there.

    Nothing is bound on it: it files its own save and closes itself once that
    has landed, and its `close` is a report rather than a request.
  -->
  <TaskDialog ref="taskDialogEl" />

  <!--
    The confirmation, mounted beside the sheet and outside `MainLayout` for the
    same two reasons: a modal renders in the top layer wherever it is written,
    and it has to still be here when it closes for the browser to hand focus
    back to whatever asked the question.

    It is up to nothing on its own — `open(task)` is the only thing that raises
    it, and it is answered by an event rather than by a return value, so a
    delete that has to go to the server can take as long as it takes.
  -->
  <DeleteDialog
    ref="deleteDialogEl"
    @confirm="onConfirmDelete"
  />
</template>
