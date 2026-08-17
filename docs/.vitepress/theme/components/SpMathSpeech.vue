<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpTex from "./SpTex.vue";

const EXAMPLES = [
  "x^2+1",
  "(2+3)^2",
  "\\frac{a+b}{2}",
  "\\sqrt{16}",
  "\\sin(x)=1",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
];

const input = ref("(2+3)^2");
const math = useMath();
const outcome = computed(() =>
  attempt(math.value, input.value, (engine) => engine.describe(input.value)),
);

/** The table the library exports, not a copy kept in the docs. */
const rows = computed(() => {
  const api = math.value;
  if (api === null || api instanceof Error) return [];
  return Object.entries(api.operatorWords).map(([symbol, word]) => ({ symbol, word }));
});
</script>

<template>
  <DemoShell title="math.describe(latex) — and OPERATOR_WORDS" icon="i-hugeicons-audio-wave-01">
    <label class="sp-field">
      <span class="sp-field__label">LaTeX</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
    </label>

    <div class="sp-chips">
      <button
        v-for="example in EXAMPLES"
        :key="example"
        type="button"
        class="sp-chip"
        @click="input = example"
      >
        {{ example }}
      </button>
    </div>

    <SpMathLoading v-if="outcome.status === 'loading'" />

    <SpMathError
      v-else-if="outcome.status === 'error'"
      :name="outcome.name"
      :message="outcome.message"
    />

    <p v-else-if="outcome.status === 'ok'" class="sp-speech__said">
      <SpTex :tex="input" />
      <span class="i-hugeicons-arrow-right-01" aria-hidden="true" />
      <span class="sp-speech__words">“{{ outcome.value }}”</span>
    </p>

    <details v-if="rows.length" class="sp-speech__table">
      <summary>OPERATOR_WORDS — {{ rows.length }} symbols</summary>
      <ul>
        <li v-for="row in rows" :key="row.symbol">
          <code>{{ row.symbol }}</code>
          <span>{{ row.word }}</span>
        </li>
      </ul>
    </details>

    <template #hint>
      The comma in “the quantity 2 plus 3, squared” is load-bearing: without the pause the same
      words are heard as “the quantity 2, plus 3 squared”, which is a different expression.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-speech__said {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
}

.sp-speech__words {
  font-size: 15px;
  font-style: italic;
}

.sp-speech__table {
  font-size: 13px;
}

.sp-speech__table summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
}

.sp-speech__table ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 4px 12px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.sp-speech__table li {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sp-speech__table code {
  font-size: 12px;
}

.sp-speech__table span {
  color: var(--vp-c-text-2);
}
</style>
