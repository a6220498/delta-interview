<script setup lang="ts">
import { ref } from 'vue'

import Header from '@/components/Header/index.vue'
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
 * trays' `toggle` and `menu` events are deliberately left unhandled, since
 * there is nothing here that could carry them anywhere.
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
</script>

<template>
  <MainLayout>
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
      />
    </div>
  </MainLayout>
</template>
