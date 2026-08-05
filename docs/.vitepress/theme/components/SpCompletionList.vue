<script setup lang="ts">
import type { Completion } from "@smartput/core";
import { computed } from "vue";
import { kindIcon } from "../engine";

const props = withDefaults(
  defineProps<{
    rows: Completion[];
    active: number;
    /** The text `rows` were computed from, used to split the matched prefix. */
    input: string;
    /** Tighter padding for the hero surface. */
    dense?: boolean;
  }>(),
  { dense: false },
);

const emit = defineEmits<{ pick: [row: Completion] }>();

/**
 * The alias split at the length of what was typed. `span` comes from the
 * completion itself rather than from a second search of the input, so the bold
 * run is exactly the fragment the engine matched — including when the input
 * holds a whole expression and only its last token is being completed.
 */
const parts = computed(() =>
  props.rows.map((row) => {
    const typed = props.input.slice(row.span.start, row.span.end);
    return {
      matched: row.alias.slice(0, typed.length),
      rest: row.alias.slice(typed.length),
    };
  }),
);
</script>

<template>
  <ul class="sp-comp" :class="{ 'sp-comp--dense': dense }" role="listbox">
    <li
      v-for="(row, i) in rows"
      :key="`${row.kind}:${row.unit}`"
      role="option"
      :aria-selected="i === active"
      :class="{ 'is-active': i === active }"
    >
      <button type="button" @mousedown.prevent="emit('pick', row)">
        <span :class="kindIcon(row.kind)" class="sp-comp__icon" aria-hidden="true" />
        <span class="sp-comp__alias">
          <b>{{ parts[i]?.matched }}</b><span>{{ parts[i]?.rest }}</span>
        </span>
        <span class="sp-comp__text">{{ row.text }}</span>
        <span class="sp-comp__kind">{{ row.kind }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.sp-comp {
  list-style: none;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sp-comp button {
  width: 100%;
  display: grid;
  grid-template-columns: 18px minmax(0, auto) minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 7px;
  text-align: left;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-2);
  transition: background-color 0.15s;
}

.sp-comp--dense button {
  padding: 5px 8px;
  font-size: 12.5px;
}

.sp-comp li.is-active button,
.sp-comp button:hover {
  background: var(--vp-c-default-soft);
}

.sp-comp__icon {
  color: var(--vp-c-text-3);
  align-self: center;
}

.sp-comp__alias b {
  color: var(--vp-c-brand-1);
}

.sp-comp__text {
  color: var(--vp-c-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-comp__kind {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
}

@media (max-width: 520px) {
  .sp-comp button {
    grid-template-columns: 18px minmax(0, auto) minmax(0, 1fr);
  }
  .sp-comp__kind {
    display: none;
  }
}
</style>
