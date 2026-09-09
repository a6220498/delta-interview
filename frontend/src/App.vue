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
 * The board's tasks, and how the load that fetched them went. `storeToRefs` keeps the
 * reactivity plain destructuring would drop. `toggle` and `delete` are still unhandled.
 */
const tasksStore = useTasksStore()
const { taskList, loading, error } = storeToRefs(tasksStore)

/**
 * Fills the board on first paint. Nothing awaits or catches it on purpose: the store
 * records a failure in `error`, and the notice below is what the reader gets.
 */
onMounted(() => {
  void tasksStore.fetchTasks()
})

/**
 * Runs the load again, behind the failure notice's 重試. Its own function, or the
 * click's `MouseEvent` would arrive where the filter goes.
 *
 * @returns Nothing; the outcome lands in the store, not here.
 */
function reload(): void {
  void tasksStore.fetchTasks()
}

/**
 * The tasks belonging on one shelf. The rule is the rack's own `completed`, so the
 * board never names a shelf and a task matches exactly one rack.
 *
 * @param rack - The shelf being drawn.
 * @returns The tasks in that completion state, in board order.
 */
function tasksFor(rack: TaskRack): TaskSummary[] {
  return taskList.value.filter((task) => task.completed === rack.completed)
}

/**
 * The sheet itself, rather than a pair of refs describing one: the browser can close a
 * `<dialog>` on its own. Raising it is all the board does — the sheet files its own save.
 */
const taskDialogEl = useTemplateRef<TaskDialogExposed>('taskDialogEl')

/** Opens a blank sheet, on no task: what is filed from it will be a new one. */
function openCreate(): void {
  taskDialogEl.value?.open('create')
}

/**
 * Opens the sheet on an existing task. The whole task is fetched first: a sheet opened
 * on the row alone would save an empty 說明 over detail its reader was never shown.
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
 * The confirmation, held the same way as the sheet above. Held but not yet raised —
 * wiring 刪除 to `open(task)` belongs to the step that can also delete.
 */
const deleteDialogEl = useTemplateRef<DeleteDialogExposed>('deleteDialogEl')

/**
 * Closes an answered confirmation, and nothing else — for now. The task is dropped
 * rather than spliced out: there is no `DELETE` yet, and the next load would restore it.
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
      The failure notice sits above the shelves rather than replacing them: a refresh
      that fails leaves the last good board on screen. Its gap is the board's to set.
    -->
    <LoadFailure
      v-if="error"
      :reason="error"
      class="mb-[14px]"
      @retry="reload"
    />

    <!--
      Two equal columns, one below 880px where a pair of trays cannot hold a stub
      and title side by side. items-start lets a short tray keep its own height.
    -->
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
    One sheet for both jobs, opened by name and left mounted while closed so the
    browser can hand focus back. Outside `MainLayout`: a modal renders in the top layer.
  -->
  <TaskDialog ref="taskDialogEl" />

  <!--
    The confirmation, mounted beside the sheet for the same two reasons. `open(task)`
    is the only thing that raises it, and an event is what answers it.
  -->
  <DeleteDialog
    ref="deleteDialogEl"
    @confirm="onConfirmDelete"
  />
</template>
