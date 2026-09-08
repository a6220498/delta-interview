<script setup lang="ts">
/**
 * The masthead: an ink plate carrying the application's name, with a printed-form
 * double rule running out to the right of it.
 *
 * The plate is the one place in the whole interface where the paper is flipped
 * to ink — that inversion is what makes it read as the top of a form rather
 * than as another card, so nothing else may borrow it.
 *
 * The root is a plain element, not a second `<header>`: the landmark belongs to
 * `MainLayout`, and nesting one header inside another gives assistive tech two
 * where the page has one.
 */
</script>

<template>
  <div class="flex items-stretch gap-3.5">
    <!--
      min-w-0 lets the plate shrink below its text's intrinsic width so a long
      name wraps inside the plate instead of pushing the rule off-screen.
    -->
    <div class="min-w-0 rounded-sm bg-ink px-6 pt-3.5 pb-[17px]">
      <!--
        font-display puts Barlow Semi Condensed first, which contributes no
        glyphs to a Han string — Noto Sans TC renders every character here, and
        it is the face that actually ships the 900 weight this asks for.

        Preflight strips a heading's own size and weight, so both are stated.
        The negative right margin cancels the trailing letter-space, which would
        otherwise sit between the last character and the plate's right edge and
        make the padding look uneven.
      -->
      <h1
        class="-mr-[0.15em] font-display text-[clamp(25px,4.5vw,40px)] leading-[1.12] font-black tracking-[0.15em] text-balance text-stock"
      >
        任務管理應用程式
      </h1>
    </div>

    <!--
      Bottom-aligned to the plate's baseline area, thick-over-thin the way a
      paper form separates its heading from its body. Below 520px there is no
      room left beside the plate, so it goes rather than wrapping to its own row.
    -->
    <div
      class="mb-[15px] h-2 grow self-end border-t-2 border-b border-ink max-[520px]:hidden"
      aria-hidden="true"
    />
  </div>
</template>
