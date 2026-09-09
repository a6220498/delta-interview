<script setup lang="ts">
/**
 * One shelf of the board, rendered once per rack: everything that differs arrives
 * in `rack`. It takes its tasks as a prop and does no filtering of its own.
 */
import Card from './Card.vue'
import type { TaskListEmits, TaskListProps } from './types'

const props = defineProps<TaskListProps>()

const emit = defineEmits<TaskListEmits>()
</script>

<template>
  <!-- [AI assisted 010] min-h-[220px] 拿掉，改成 min-h-0。那個 220px 是規格裡用來擋
       「空架子塌在滿架子旁邊」的，現在托盤是被格線拉滿高度的，塌不了；留著反而會在視窗矮
       的時候把外框頂出去，整頁又冒出捲軸，等於把這次要修的問題原地放回來。 -->

  <div
    data-tray
    :aria-busy="props.loading ? true : undefined"
    class="flex min-h-0 flex-col border border-t-[3px] border-tray-edge border-t-ink bg-tray p-2.5"
  >
    <div class="flex items-center gap-2 px-1 pt-0.5 pb-2.5">
      <!-- Preflight strips a heading's own size and weight, so both are stated. -->
      <h3 class="font-display text-[15px] font-semibold tracking-[0.1em] uppercase">
        {{ props.rack.title }}
      </h3>

      <!-- Left in the accessibility tree: read after the heading it says "未完成, 3". -->
      <span
        data-tally
        class="min-w-[26px] rounded-sm px-1.5 pt-[5px] pb-1.5 text-center text-[15px] leading-none font-bold tabular-nums text-stock"
        :class="props.rack.tally"
      >
        {{ props.tasks.length }}
      </span>

      <!-- Lettering stamped into the tray; announcing it would repeat 未完成 in English. -->
      <span
        data-hint
        aria-hidden="true"
        class="ml-auto border-b border-ink pb-px font-display text-[11.5px] font-semibold tracking-[0.18em] uppercase"
      >
        {{ props.rack.hint }}
      </span>
    </div>

    <!--
      Replaces the list rather than sitting inside it, so an empty shelf is never
      announced as a list of one. The same box carries the wait, keeping the height.
    -->
    <p
      v-if="props.tasks.length === 0"
      class="flex flex-1 items-center justify-center rounded-sm border border-dashed border-tray-edge px-2 py-[22px] text-center font-mono text-[11.5px] tracking-[0.06em] text-ink-2"
    >
      {{ props.loading ? '載入中 —— 正在取回架上的單子' : props.rack.empty }}
    </p>

    <!--
      role="list" is explicit: preflight strips the markers and some browsers drop
      list semantics with them, costing the "3 items" a reader gets up front.
    -->
    <!--
      [AI assisted 010] overflow-x 必須明寫 hidden。只寫 overflow-y-auto 的話，CSS 會把
      另一軸從 visible 自動算成 auto，而卡片右上那顆 26px 的 ⋯ 鈕，字符本來就比框寬 4px
      —— 以前 overflow 是 visible，沒人看得出來；一變成捲動容器，那 4px 就長出一條橫捲軸。
    -->
    <!--
      The list is the one box on the board that scrolls: it takes the height the tray
      has left and keeps the overflow to itself, so a shelf filling up never lengthens
      the page. Vertically only — a docket wraps its title rather than running off the
      side, so there is never anything to reach by scrolling across.
    -->
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
