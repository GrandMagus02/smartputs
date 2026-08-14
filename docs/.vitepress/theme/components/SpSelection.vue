<script setup lang="ts">
import { Range } from "@smartput/range/class";
import { computed, ref } from "vue";
import DemoShell from "./DemoShell.vue";

/**
 * The class door, with no engine anywhere near it: a string and a list.
 * `Range.parse` returns `null` rather than throwing, which is what lets a
 * launcher try it on every keystroke and ignore the misses.
 */
const items = ref("a, b, c, d, e, f, g, h, i, j");
const input = ref("first three");

const list = computed(() =>
  items.value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== ""),
);

const parsed = computed(() => Range.parse(input.value));

const sliced = computed(() => parsed.value?.slice(list.value) ?? null);

/** Positions, not items — the set the highlight below reads. */
const chosen = computed(() => new Set(parsed.value?.indices(list.value.length) ?? []));

/** As written, before resolution: `last three` is `[-3, -1]` at any length. */
const written = computed(() =>
  parsed.value === null ? null : `[${parsed.value.start}, ${parsed.value.end}]`,
);

const examples = [
  "first three",
  "last three",
  "from 6 to 9",
  "4-5",
  "(1;5]",
  "top 3",
  "first",
  "last",
];
</script>

<template>
  <DemoShell title="Range.parse(text)?.slice(list)" icon="i-lucide-list-ordered">
    <label class="sp-field">
      <span class="sp-field__label">Selection</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. first three"
      />
    </label>

    <div class="sp-chips">
      <button
        v-for="example in examples"
        :key="example"
        type="button"
        class="sp-chip"
        @click="input = example"
      >
        {{ example }}
      </button>
    </div>

    <label class="sp-field">
      <span class="sp-field__label">List</span>
      <input v-model="items" type="text" class="sp-input sp-input--sm" spellcheck="false" />
    </label>

    <p v-if="sliced === null" class="sp-empty">
      <span class="i-lucide-circle-alert" aria-hidden="true" />
      <code>Range.parse()</code> returned <code>null</code> — not a selection.
    </p>

    <div v-else class="sp-sel">
      <p class="sp-sel__row">
        <span class="sp-sel__key">stored</span>
        <code>{{ written }}</code>
        <span class="sp-sel__note">
          written from one, stored from zero; a negative end counts back
        </span>
      </p>
      <p class="sp-sel__row">
        <span class="sp-sel__key">slice</span>
        <code>{{ JSON.stringify(sliced) }}</code>
      </p>
      <ol class="sp-sel__items">
        <li v-for="(item, i) in list" :key="`${item}-${i}`" :class="{ 'sp-sel__on': chosen.has(i) }">
          {{ item }}
        </li>
      </ol>
    </div>
  </DemoShell>
</template>

<style scoped>
.sp-sel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-sel__row {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
}

.sp-sel__key {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.sp-sel__note {
  color: var(--vp-c-text-3);
  font-size: 11.5px;
}

.sp-sel__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp-sel__items li {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.sp-sel__items li.sp-sel__on {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.sp-empty {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
