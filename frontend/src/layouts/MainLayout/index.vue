<script setup lang="ts">
/**
 * The page frame every screen sits in: the `.wrap` metrics from `docs/ui-spec.html`
 * (centred, 1060px cap, 20px gutters, 72px of tail room), the two landmarks, and
 * the content area's heading row — a title on the left, the screen's one primary
 * action on the right, ruled off from the content below it.
 *
 * The masthead is slotted rather than written in here. It is the only header
 * this version has, but baking it into the frame would make the frame the
 * masthead's owner — every later screen would inherit it whether or not it
 * wants it. The layout owns page geometry; what goes in the header is the
 * caller's decision.
 *
 * The heading row is the other way round: its geometry is fixed by the spec, so
 * the frame draws it and takes only its wording and its click as inputs. The
 * layout never decides what the button *does* — see `action` in `./types`.
 *
 * `<header>` and `<main>` rather than two `<div>`s: those are free landmarks a
 * screen reader can jump between, and the div version would have to earn the
 * same thing back with explicit `role` attributes.
 */
import { MAIN_LAYOUT_DEFAULTS } from './const'
import type { MainLayoutEmits, MainLayoutProps } from './types'

withDefaults(defineProps<MainLayoutProps>(), MAIN_LAYOUT_DEFAULTS)

const emit = defineEmits<MainLayoutEmits>()
</script>

<template>
  <!-- pb-18 (72px) keeps the last card clear of the mobile floating button. -->
  <div class="mx-auto w-full max-w-[1060px] px-5 pb-18">
    <header class="pt-[38px]">
      <slot name="header" />
    </header>

    <main>
      <!--
        A plain <section>: with no accessible name it stays out of the landmark
        list, so the page keeps the two landmarks the layout promises rather
        than growing a third, unnamed region for a screen reader to step through.
      -->
      <section class="mt-[54px]">
        <!--
          Baseline alignment sits the title's and the button's text on one line
          regardless of their different sizes; the button opts out with
          self-center, since a 34px box hung off a baseline reads as slipped.
        -->
        <div class="mb-[18px] flex items-baseline gap-3 border-b border-ink pb-1.5">
          <!--
            Preflight strips a heading's own size and weight, so both are stated.
            grow lets the title take the row's slack and push the button right.
          -->
          <h2 class="grow font-display text-[21px] font-semibold tracking-[0.01em]">
            {{ heading }}
          </h2>

          <!--
            The one inked control on the page. cursor-pointer is explicit
            because Tailwind 4's preflight gives buttons `cursor: default`.
          -->
          <button
            type="button"
            class="inline-flex min-h-[34px] cursor-pointer appearance-none items-center gap-[7px] self-center rounded-sm border border-ink bg-ink px-3.5 font-display text-[14.5px] font-semibold tracking-[0.05em] whitespace-nowrap text-stock hover:border-stamp hover:bg-stamp focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
            @click="emit('action')"
          >
            <!-- Full-width ＋ to match the CJK label's weight; announced by the label, not by this. -->
            <span aria-hidden="true">＋</span>{{ actionLabel }}
          </button>
        </div>

        <slot />
      </section>
    </main>
  </div>
</template>
