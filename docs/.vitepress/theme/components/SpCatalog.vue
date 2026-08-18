<script setup lang="ts">
import { computed } from "vue";
import { type CatalogItem, catalogGroup } from "../catalog";

/**
 * A grid of cards, one per link. Two callers, one shape: the packages index
 * hands it a group name and it reads the generated catalog; the examples index
 * hands it the rows inline.
 *
 * The heading above the grid stays in Markdown rather than moving in here —
 * VitePress builds "On this page" from the rendered Markdown headings only, so
 * a component that printed its own would be a section the outline cannot see.
 */
const props = withDefaults(
  defineProps<{
    /** A group from the generated packages catalog — "Kinds", "Money", … */
    group?: string;
    /** Rows given directly, for a page whose cards are not packages. */
    items?: CatalogItem[];
  }>(),
  { group: undefined, items: undefined },
);

/**
 * The summaries are Markdown — they are the same strings the package pages take
 * as their description — and the one piece of Markdown that turns up in them is
 * a code span. Splitting on the backtick and marking the odd segments renders
 * it without handing anything to `v-html`.
 */
function segments(summary: string): { text: string; code: boolean }[] {
  return summary
    .split("`")
    .map((text, index) => ({ text, code: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}

const rows = computed(() =>
  (props.items ?? (props.group ? catalogGroup(props.group) : [])).map(
    (item: CatalogItem) => ({ ...item, segments: segments(item.summary) }),
  ),
);
</script>

<template>
  <ul class="sp-cat" role="list">
    <li v-for="row in rows" :key="row.link" class="sp-cat__cell">
      <!-- The whole card is the link. A card with a link *inside* it means a
           140x90 hit area that only works in one 12px corner of itself. -->
      <a class="sp-cat__card" :href="row.link">
        <span class="sp-cat__head">
          <span class="sp-cat__icon" :class="row.icon ?? 'i-hugeicons-package'" aria-hidden="true" />
          <span class="sp-cat__title">{{ row.title }}</span>
        </span>

        <span class="sp-cat__summary">
          <template v-for="(part, index) in row.segments" :key="index">
            <code v-if="part.code" class="sp-cat__inline">{{ part.text }}</code>
            <template v-else>{{ part.text }}</template>
          </template>
        </span>

        <code v-if="row.example" class="sp-cat__example">{{ row.example }}</code>
      </a>
    </li>
  </ul>
</template>

<style scoped>
.sp-cat {
  list-style: none;
  padding: 0;
  margin: 16px 0 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(202px, 1fr));
  gap: 12px;
}

.sp-cat__cell {
  margin: 0;
  display: flex;
}

.sp-cat__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 14px 16px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  color: inherit;
  font-weight: 400;
  text-decoration: none;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.sp-cat__card:hover {
  border-color: var(--vp-c-brand-2);
  background: var(--vp-c-bg-elv);
  transform: translateY(-1px);
}

.dark .sp-cat__card:hover {
  box-shadow: 0 0 28px -14px var(--sp-magenta);
}

.sp-cat__card:focus-visible {
  outline: 2px solid var(--vp-c-brand-2);
  outline-offset: 2px;
}

.sp-cat__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-cat__icon {
  flex: none;
  color: var(--vp-c-brand-1);
}

.sp-cat__title {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  word-break: break-word;
}

.sp-cat__summary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  /* The summaries are one line of prose each and the cards sit in a row, so
     the example line has to start at the same height across the row. */
  flex: 1;
}

.sp-cat__inline {
  font-size: 12px;
  background: var(--vp-c-bg-alt);
  padding: 1px 4px;
  border-radius: 4px;
}

/* The example is what the package reads, not what it returns — a card cannot
   run the engine, and a printed result nobody computed is the one thing the
   demos on every other page exist to avoid. */
.sp-cat__example {
  align-self: flex-start;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.sp-cat__card:hover .sp-cat__example {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-2);
}

@media (max-width: 420px) {
  .sp-cat {
    grid-template-columns: 1fr;
  }
}
</style>
