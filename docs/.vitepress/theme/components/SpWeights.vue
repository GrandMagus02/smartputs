<script setup lang="ts">
import type { Weights } from "@smartput/core";
import { computed, reactive, ref } from "vue";
import { createDocsEngine, evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

interface WeightRow {
  selector: string;
  value: number;
  enabled: boolean;
}

const input = ref("10 m");

/**
 * Layer 3 of the weight stack (`createEngine({ weights })`). Every selector
 * that matches a candidate adds its value — there is no precedence table, so
 * flipping rows on and off is exactly what the solver sees.
 */
const rows = reactive<WeightRow[]>([
  { selector: "duration:min", value: 20, enabled: false },
  { selector: "length", value: 0, enabled: false },
  { selector: "token:m", value: 0, enabled: false },
]);

const weights = computed<Weights>(() => {
  const out: Weights = {};
  for (const row of rows) {
    if (row.enabled && row.selector.trim() !== "") out[row.selector.trim()] = row.value;
  }
  return out;
});

const engine = computed(() =>
  createDocsEngine({ weights: weights.value, tiebreak: "error" }),
);

const outcome = computed(() => evaluateSafely(engine.value, input.value));

const ranked = computed(() =>
  input.value.trim() === "" ? [] : engine.value.suggest(input.value),
);

const weightsJson = computed(() =>
  Object.keys(weights.value).length === 0 ? "{}" : JSON.stringify(weights.value, null, 2),
);

function addRow() {
  rows.push({ selector: "", value: 0, enabled: true });
}
</script>

<template>
  <DemoShell title="Weights change the ranking" icon="i-lucide-sliders-horizontal">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
      />
    </label>

    <div class="sp-weights">
      <div class="sp-weights__head">
        <span>on</span>
        <span>selector</span>
        <span>value</span>
      </div>
      <div v-for="(row, i) in rows" :key="i" class="sp-weights__row">
        <input v-model="row.enabled" type="checkbox" :aria-label="`enable ${row.selector}`" />
        <input
          v-model="row.selector"
          type="text"
          class="sp-input sp-input--sm"
          spellcheck="false"
          placeholder="kind, kind:unit or token:form"
        />
        <input
          v-model.number="row.value"
          type="number"
          step="1"
          class="sp-input sp-input--sm sp-input--num"
        />
      </div>
      <button type="button" class="sp-chip" @click="addRow">
        <span class="i-lucide-layers" aria-hidden="true" /> add selector
      </button>
    </div>

    <pre class="sp-code">createEngine({ weights: {{ weightsJson }} })</pre>

    <SpResult :outcome="outcome" compact />

    <ul v-if="ranked.length > 1" class="sp-ranklite">
      <li v-for="(candidate, i) in ranked" :key="i">
        <code>{{ candidate.kind }}:{{ candidate.value.unit }}</code>
        <span>{{ (candidate.confidence * 100).toFixed(1) }}%</span>
      </li>
    </ul>

    <template #hint>
      With no weights, <code>10 m</code> is a genuine tie between
      <code>length:m</code> and <code>duration:min</code>, so
      <code>evaluate()</code> throws <code>AmbiguityError</code>. Enable
      <code>duration:min +20</code> and minutes win outright.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-weights {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.sp-weights__head,
.sp-weights__row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 90px;
  gap: 8px;
  align-items: center;
}

.sp-weights__head {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}

.sp-weights__row input[type='checkbox'] {
  justify-self: center;
  accent-color: var(--vp-c-brand-1);
}

.sp-code {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-x: auto;
}

.sp-ranklite {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.sp-ranklite li {
  display: flex;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
</style>
