<script setup lang="ts">
import type { Explanation } from "@smartput/core";
import { SmartputError } from "@smartput/core";
import { computed, ref } from "vue";
import { docsEngine } from "../engine";
import DemoShell from "./DemoShell.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    examples?: string[];
    hint?: string;
  }>(),
  {
    modelValue: "10 m + 5 min",
    examples: () => ["10 m", "10 m + 5 min", "1 kg + 500 g", "1.5 kilograms"],
    hint: undefined,
  },
);

const input = ref(props.modelValue);

type ExplainState =
  | { status: "ok"; explanation: Explanation }
  | { status: "error"; name: string; message: string };

/** `explain()` shares the strict pipeline, so it throws where `evaluate()` would. */
const state = computed<ExplainState>(() => {
  try {
    return { status: "ok", explanation: docsEngine.explain(input.value) };
  } catch (error) {
    // `error.name`, not `constructor.name` — the client bundle is minified.
    if (error instanceof SmartputError) {
      return { status: "error", name: error.name, message: error.message };
    }
    return {
      status: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const tokenLabel = (token: Explanation["tokens"][number]): string => {
  switch (token.type) {
    case "number":
    case "word":
      return token.text;
    case "op":
      return token.op;
    case "keyword":
      return token.keyword;
    case "lparen":
      return "(";
    case "rparen":
      return ")";
  }
};
</script>

<template>
  <DemoShell title="engine.explain(input)" icon="i-lucide-microscope" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. 10 m + 5 min"
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

    <div v-if="state.status === 'error'" class="sp-explain__error">
      <code>{{ state.name }}</code>
      <span>{{ state.message }}</span>
    </div>

    <template v-else>
      <h5 class="sp-explain__h">1. Tokens</h5>
      <div class="sp-tokens">
        <span
          v-for="(token, i) in state.explanation.tokens"
          :key="i"
          class="sp-token"
          :data-type="token.type"
        >
          <em>{{ token.type }}</em>{{ tokenLabel(token) }}
        </span>
      </div>

      <h5 class="sp-explain__h">2. Candidates</h5>
      <table class="sp-table">
        <thead>
          <tr>
            <th>surface</th>
            <th>lemma</th>
            <th>kind:unit</th>
            <th class="sp-num">weight</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(candidate, i) in state.explanation.candidates" :key="i">
            <td><code>{{ candidate.surface }}</code></td>
            <td><code>{{ candidate.form }}</code></td>
            <td><code>{{ candidate.kind }}:{{ candidate.unit }}</code></td>
            <td class="sp-num">{{ signed(candidate.weight) }}</td>
          </tr>
        </tbody>
      </table>

      <h5 class="sp-explain__h">3. Scored assignments</h5>
      <div
        v-for="(assignment, i) in state.explanation.assignments"
        :key="i"
        class="sp-assign"
        :class="{ 'sp-assign--winner': i === 0 }"
      >
        <div class="sp-assign__head">
          <code>{{ assignment.kind }}</code>
          <span class="sp-assign__units">{{ assignment.units.join(', ') }}</span>
          <span class="sp-assign__score">
            raw {{ assignment.score }} · confidence
            {{ (assignment.confidence * 100).toFixed(1) }}%
          </span>
        </div>
        <ul class="sp-assign__terms">
          <li v-for="(contribution, j) in assignment.contributions" :key="j">
            <code>{{ contribution.selector }}</code>
            <span>{{ signed(contribution.value) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-explain__h {
  margin: 16px 0 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}

.sp-explain__h:first-of-type {
  margin-top: 12px;
}

.sp-explain__error {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
  border-radius: 8px;
  font-size: 13px;
}

.sp-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp-token {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.sp-token em {
  font-style: normal;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-table {
  display: table;
  width: 100%;
  margin: 0;
  font-size: 12px;
}

.sp-table th,
.sp-table td {
  padding: 5px 8px;
}

.sp-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sp-assign {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--vp-c-bg);
}

.sp-assign--winner {
  border-color: var(--vp-c-brand-1);
}

.sp-assign__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}

.sp-assign__units {
  color: var(--vp-c-text-2);
  font-size: 12px;
}

.sp-assign__score {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.sp-assign__terms {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 2px 12px;
  font-size: 12px;
}

.sp-assign__terms li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px dashed var(--vp-c-divider);
  padding: 2px 0;
}

.sp-assign__terms span {
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
}
</style>
