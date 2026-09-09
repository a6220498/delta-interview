<script setup lang="ts">
/**
 * One docket-shaped placeholder, held on a shelf while its stack is still on the wire.
 * Pure decoration: it carries no task, no controls and nothing to announce — the tray's
 * own `aria-busy` and the notice beside it are what tell a reader the board is waiting.
 */
</script>

<template>
  <article
    data-skeleton
    aria-hidden="true"
    class="relative grid grid-cols-[26px_1fr] rounded-sm border border-rule bg-stock shadow-[0_1px_0_rgba(31,28,24,0.18)]"
  >
    <!-- The punches are painted the tray's colour, exactly as on a filled card. -->
    <div
      class="relative flex flex-col items-center justify-center gap-[7px] rounded-l-sm border-r border-dashed border-rule bg-stub py-2 text-ink-3 before:absolute before:-top-1 before:-right-1 before:size-[7px] before:rounded-full before:bg-tray before:content-[''] after:absolute after:-right-1 after:-bottom-1 after:size-[7px] after:rounded-full after:bg-tray after:content-['']"
    >
      <!--
        An empty dashed box rather than nothing: the category is not back yet, but its
        15px is claimed now, so the number below it does not drop when the mark arrives.
      -->
      <span class="size-[15px] flex-none rounded-sm border-[1.5px] border-dashed border-current opacity-50" />

      <code
        class="font-mono text-[10.5px] font-bold tracking-[0.1em] tabular-nums [writing-mode:vertical-rl]"
      >
        · · · ·
      </code>
    </div>

    <div class="min-w-0 px-[11px] pt-[9px] pb-2">
      <!-- Two bars, long then short: a title wraps to roughly this, and a bar of a
           fixed width would read as a real one-line title that never resolves. -->
      <div class="h-[11px] w-[70%] rounded-[1px] bg-rule-2" />
      <div class="mt-[7px] h-[11px] w-[45%] rounded-[1px] bg-rule-2" />

      <!--
        The mark's outline, faded and inert. Drawn at all because the foot is what
        sets the card's height; dropping it would make every docket grow on arrival.
      -->
      <div class="mt-[9px] flex flex-wrap items-center gap-2">
        <span
          class="inline-flex min-h-6 items-center gap-1.5 rounded-sm border border-rule py-[3px] pr-[7px] pl-[5px] font-mono text-[10.5px] tracking-[0.06em] text-ink-2 opacity-40"
        >
          <!-- Empty, not a transparent ✓: there is no state yet to leave room for. -->
          <span class="grid size-3 place-items-center border-[1.5px] border-ink-3" />
          ———
        </span>
      </div>
    </div>
  </article>
</template>
