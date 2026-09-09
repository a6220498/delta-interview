<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import { useTaskDrag } from '@/composables/useTaskDrag'
import { useTasksStore } from '@/stores/tasks'

import Card from './Card.vue'
import type { TaskListEmits, TaskListProps } from './types'

const props = defineProps<TaskListProps>()

const emit = defineEmits<TaskListEmits>()

const tasksStore = useTasksStore()

const { accepts, dragged, release } = useTaskDrag()

// root element(trayEl)
const trayEl = useTemplateRef<HTMLElement>('trayEl')

/** Whether a docket this shelf could actually take is currently held over it. */
const over = ref(false)

// drop error
const dropError = ref('')

const filing = new Set<string>()

/**
 * Offers the shelf to a docket that belongs elsewhere. Cancelling the event is what
 * makes this element a drop target at all — without it the browser refuses the drop.
 *
 * @param event - The `dragover`, cancelled only for a docket this shelf can take.
 */
function onDragOver(event: DragEvent): void {
  if (!accepts(props.rack)) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  over.value = true
}

/**
 * Takes the offer down once the docket is carried back out of the tray.
 *
 * @param event - DragEvent
 */
function onDragLeave(event: DragEvent): void {
  if (!trayEl.value?.contains(event.relatedTarget as Node | null)) {

    over.value = false
  }
}

/**
 * Files the state of this shelf for the docket dropped on it — the same endpoint the
 * card's mark presses, since the shelf a docket hangs on is its completion state.
 *
 * @param event - The `drop`, cancelled so the browser does not also act on it.
 * @returns Resolves once the stamp is back, refused or filed.
 */
async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  over.value = false

  const docket = dragged.value

  // Let go before the await: the gesture is over the moment the docket lands, and
  // `dragend` is not guaranteed to arrive before whatever the shelf asks for does.
  release()

  if (!docket || docket.completed === props.rack.completed || filing.has(docket.id)) {
    return
  }

  // Cleared first: what is on the tray is about the previous docket dropped here.
  dropError.value = ''
  filing.add(docket.id)

  try {
    await tasksStore.setTaskCompletion(docket.id, props.rack.completed)
  } catch (cause) {
    // Not only `ApiError`: `fetch` itself rejects with a TypeError when the
    // backend is not running, which is the likeliest failure in development.
    dropError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    filing.delete(docket.id)
  }
}
</script>

<template>
  <!-- [AI assisted 010] min-h-[220px] 拿掉，改成 min-h-0。那個 220px 是規格裡用來擋
       「空架子塌在滿架子旁邊」的，現在托盤是被格線拉滿高度的，塌不了；留著反而會在視窗矮
       的時候把外框頂出去，整頁又冒出捲軸，等於把這次要修的問題原地放回來。 -->

  <div
    ref="trayEl"
    data-tray
    :aria-busy="props.loading ? true : undefined"
    :data-over="over || undefined"
    class="flex min-h-0 flex-col border border-t-[3px] border-tray-edge border-t-ink bg-tray p-2.5"
    :class="over ? 'shadow-[inset_0_0_0_2px_var(--color-stamp)]' : undefined"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="flex items-center gap-2 px-1 pt-0.5 pb-2.5">
      <h3 class="font-display text-[15px] font-semibold tracking-[0.1em] uppercase">
        {{ props.rack.title }}
      </h3>

        <!-- task counts  -->
      <span
        data-tally
        class="min-w-[26px] rounded-sm px-1.5 pt-[5px] pb-1.5 text-center text-[15px] leading-none font-bold tabular-nums text-stock"
        :class="props.rack.tally"
      >
        {{ props.tasks.length }}
      </span>
      <!-- hint  -->
      <span
        data-hint
        aria-hidden="true"
        class="ml-auto border-b border-ink pb-px font-display text-[11.5px] font-semibold tracking-[0.18em] uppercase"
      >
        {{ props.rack.hint }}
      </span>
    </div>
    <!-- drop error tip -->
    <p
      v-if="dropError"
      data-drop-error
      role="alert"
      class="mb-[9px] border-l-[3px] border-alert bg-alert-bg px-2 py-[5px] text-[11.5px] leading-[1.5] text-ink-2 [overflow-wrap:anywhere]"
    >
      <strong class="font-display font-semibold text-alert">狀態沒改到</strong>
      —— {{ dropError }}
    </p>

    <!-- tray loading or empty tip -->
    <p
      v-if="props.tasks.length === 0"
      class="flex flex-1 items-center justify-center rounded-sm border border-dashed border-tray-edge px-2 py-[22px] text-center font-mono text-[11.5px] tracking-[0.06em] text-ink-2"
    >
      {{ props.loading ? '載入中 —— 正在取回架上的單子' : props.rack.empty }}
    </p>
    <!--
      [AI assisted 010] overflow-x 必須明寫 hidden。只寫 overflow-y-auto 的話，CSS 會把
      另一軸從 visible 自動算成 auto，而卡片右上那顆 26px 的 ⋯ 鈕，字符本來就比框寬 4px
      —— 以前 overflow 是 visible，沒人看得出來；一變成捲動容器，那 4px 就長出一條橫捲軸。
    -->

    <!-- task cards list -->
    <ul
      v-else
      role="list"
      class="flex min-h-0 flex-1 flex-col gap-[9px] overflow-x-hidden overflow-y-auto"
    >
      <li
        v-for="task in props.tasks"
        :key="task.id"
      >
        <Card
          :task="task"
          @detail="emit('detail', task)"
          @edit="emit('edit', task)"
          @delete="emit('delete', task)"
        />
      </li>
    </ul>
  </div>
</template>
