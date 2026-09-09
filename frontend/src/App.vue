<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import CardDetailDialog from '@/components/CardDetailDialog/index.vue'
import type { CardDetailDialogExposed } from '@/components/CardDetailDialog/types'
import DeleteDialog from '@/components/DeleteDialog/index.vue'
import type { DeleteDialogExposed } from '@/components/DeleteDialog/types'
import Header from '@/components/Header/index.vue'
import LoadFailure from '@/components/LoadFailure/index.vue'
import RackSwitch from '@/components/RackSwitch/index.vue'
import TaskDialog from '@/components/TaskDialog/index.vue'
import type { TaskDialogExposed } from '@/components/TaskDialog/types'
import TaskList from '@/components/TaskList/index.vue'
import { TASK_RACKS } from '@/const/task'
import type { TaskRack } from '@/const/task'
import MainLayout from '@/layouts/MainLayout/index.vue'
import { useTasksStore } from '@/stores/tasks'
import type { TaskSummary } from '@/types/task'

const tasksStore = useTasksStore()
const { taskList, loading, error } = storeToRefs(tasksStore)

onMounted(() => {
  tasksStore.fetchTasks()
})

/**
 * Runs the load again, behind the failure notice's 重試. Its own function, or the
 * click's `MouseEvent` would arrive where the filter goes.
 *
 * @returns Nothing; the outcome lands in the store, not here.
 */
function reload(){
  tasksStore.fetchTasks()
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

// [AI assisted 009] 手機版一次只看一架是使用者裁示的版型。哪一架在畫面上由這裡持有，
// 但「另一架被藏起來」是 CSS 的事（max-[700px]:hidden）—— 寬螢幕兩架同時在，這個值就不管事。
const activeRackId = ref(TASK_RACKS[0]?.id ?? '')

/**
 * How many tasks are on each shelf, keyed by rack id. The switch prints both counts,
 * including the shelf it is not showing — that is what makes it worth pressing.
 */
const rackCounts = computed<Record<string, number>>(() =>
  Object.fromEntries(TASK_RACKS.map((rack) => [rack.id, tasksFor(rack).length])),
)

// [AI assisted 008] 明細跟 openEdit 相反，不先 fetch 再開窗：卡片手上那一列已經畫得出
// 六個欄位，只有說明要等，整窗一起等會讓五個已知欄位無謂地空著。
const cardDetailDialogEl = useTemplateRef<CardDetailDialogExposed>('cardDetailDialogEl')

/**
 * Pulls a docket off the shelf to be read.
 *
 * @param task - The row whose card was pressed.
 */
function openDetail(task: TaskSummary) {
  cardDetailDialogEl.value?.open(task)
}

/**
 * The sheet itself, rather than a pair of refs describing one: the browser can close a
 * `<dialog>` on its own. Raising it is all the board does — the sheet files its own save.
 */
const taskDialogEl = useTemplateRef<TaskDialogExposed>('taskDialogEl')

/** Opens a blank sheet, on no task: what is filed from it will be a new one. */
function openCreate() {
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
 * The confirmation, held the same way as the sheet above. Raising it is likewise all
 * the board does with it: the docket it names is withdrawn by the confirmation itself.
 */
const deleteDialogEl = useTemplateRef<DeleteDialogExposed>('deleteDialogEl')

/**
 * Asks before withdrawing a docket. The row is handed straight over, unfetched: the
 * question shows a number and a title, and the shelf is already holding both.
 *
 * @param task - The row whose 刪除 was pressed.
 */
function openDelete(task: TaskSummary) {
  deleteDialogEl.value?.open(task)
}
</script>

<template>
  <MainLayout @action="openCreate">
    <template #header>
      <Header />
    </template>

    <LoadFailure
      v-if="error"
      :reason="error"
      class="mb-[14px]"
      @retry="reload"
    />

    <!-- Rack Swich for small screen -->
    <RackSwitch
      v-model="activeRackId"
      :racks="TASK_RACKS"
      :counts="rackCounts"
    />

    <!-- [AI assisted 010] items-start 換成滿高：卡片一多，托盤原本會一路往下長把整頁撐出
         捲軸。auto-rows 用 minmax(0,1fr) 是為了同時吃三種版型 —— 兩欄一列、一欄兩列，
         以及 700px 以下只剩一架時的一欄一列 —— 每一種都是把可用高度分完，不看內容。 -->
    <div
      class="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-2 gap-[14px] max-[880px]:grid-cols-1"
    >
      <TaskList
        v-for="rack in TASK_RACKS"
        :key="rack.id"
        :rack="rack"
        :tasks="tasksFor(rack)"
        :loading="loading"
        :class="{ 'max-[700px]:hidden': rack.id !== activeRackId }"
        @detail="openDetail"
        @edit="openEdit"
        @delete="openDelete"
      />
    </div>
  </MainLayout>

  <CardDetailDialog ref="cardDetailDialogEl" />

  <TaskDialog ref="taskDialogEl" />

  <DeleteDialog ref="deleteDialogEl" />
</template>
