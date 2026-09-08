<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import Header from '@/components/Header/index.vue'
import TaskDialog from '@/components/TaskDialog/index.vue'
import type { TaskDialogExposed } from '@/components/TaskDialog/types'
import TaskList from '@/components/TaskList/index.vue'
import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import MainLayout from '@/layouts/MainLayout/index.vue'
import type { Task } from '@/types/task'

/**
 * The tasks on the board.
 *
 * A local ref rather than a server-backed store: fetching, optimistic updates
 * and rollback are their own step, and this is the seam that step replaces.
 * Empty until then, so both trays currently draw their empty notice — and the
 * trays' `toggle` event is deliberately left unhandled, since there is nothing
 * here that could carry it anywhere.
 */
const tasks = ref<Task[]>([])

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
function tasksFor(rack: TaskRack): Task[] {
  return tasks.value.filter((task) => task.completed === rack.completed)
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
 */
const taskDialogEl = useTemplateRef<TaskDialogExposed>('taskDialogEl')

/** Opens a blank sheet. */
function openCreate(): void {
  taskDialogEl.value?.open('create')
}

/**
 * Opens the sheet on an existing task, with its current values in the fields.
 *
 * Wired to the card's `menu` for now. The spec gives that button a popover with
 * 編輯 and 刪除 in it, and the 編輯 entry is what will own this call once the
 * menu exists; until then the button goes straight to the thing the menu's
 * first item does, rather than to nothing at all.
 *
 * @param task - The task whose docket was asked about.
 */
function openEdit(task: Task): void {
  taskDialogEl.value?.open('edit', task)
}

/**
 * Closes a submitted sheet, and nothing else — for now.
 *
 * Writing the task is the same step as the store above, and the values arriving
 * here are deliberately dropped rather than filed into the local array: a
 * client-side task would have to mint an `id` and a `sequence`, and the contract
 * gives both to the server on purpose so that no two clients can issue the same
 * number. The sheet waits to be closed rather than closing itself precisely so
 * that this line can move below a save that might fail.
 */
function onSubmit(): void {
  taskDialogEl.value?.close()
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
    -->
    <div class="grid grid-cols-2 items-start gap-[14px] max-[880px]:grid-cols-1">
      <TaskList
        v-for="rack in TASK_RACKS"
        :key="rack.id"
        :rack="rack"
        :tasks="tasksFor(rack)"
        @menu="openEdit"
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
  -->
  <TaskDialog
    ref="taskDialogEl"
    @submit="onSubmit"
  />
</template>
