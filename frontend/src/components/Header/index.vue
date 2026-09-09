<script setup lang="ts">
/**
 * The masthead: an ink plate carrying the application's name, with a double rule
 * beside it. A plain root, not a second `<header>` — the landmark is `MainLayout`'s.
 */
</script>

<template>
  <div class="flex items-stretch gap-3.5">
    <!-- min-w-0 lets a long name wrap inside the plate instead of pushing the rule off-screen. -->
    <div class="min-w-0 rounded-sm bg-ink px-6 pt-3.5 pb-[17px]">
      <!--
        Preflight strips a heading's own size and weight, so both are stated. The
        negative right margin cancels the trailing letter-space at the plate's edge.
      -->
      <h1
        class="-mr-[0.15em] font-display text-[clamp(25px,4.5vw,40px)] leading-[1.12] font-black tracking-[0.15em] text-balance text-stock"
      >
        任務管理應用程式
      </h1>
    </div>

    <!--
      Thick-over-thin, the way a paper form separates heading from body. Below
      520px there is no room beside the plate, so it goes rather than wrapping.
    -->
    <div
      class="mb-[15px] h-2 grow self-end border-t-2 border-b border-ink max-[520px]:hidden"
      aria-hidden="true"
    />
  </div>
</template>
