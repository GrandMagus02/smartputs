<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpMathSteps from "./SpMathSteps.vue";
import SpTex from "./SpTex.vue";

const PRESETS: { label: string; value: string }[] = [
  { label: "solvable", value: "x+y=2\nx-y=0" },
  { label: "contradiction", value: "x+y=2\nx+3=4\ny+1=8" },
  { label: "three unknowns", value: "x+y+z=6\nx-y=0\nz-2=0" },
  { label: "cases block", value: "\\begin{cases}2a+b=7\\\\a-b=2\\end{cases}" },
];

const input = ref(PRESETS[0]?.value ?? "");

const math = useMath();
const outcome = computed(() =>
  attempt(math.value, input.value, (engine) => engine.solveSystem(input.value)),
);

/** `solutions` is a map; the rows are what a reader actually reads. */
const rows = computed(() => {
  if (outcome.value.status !== "ok") return [];
  const solutions = outcome.value.value.solutions;
  if (solutions === null) return [];
  return Object.entries(solutions).map(([variable, value]) => `${variable}=${value}`);
});
</script>

<template>
  <DemoShell title="math.solveSystem(input, options?)" icon="i-lucide-brackets">
    <label class="sp-field">
      <span class="sp-field__label">Equations — one per line, or a <code>cases</code> block</span>
      <textarea
        v-model="input"
        rows="4"
        class="sp-input sp-input--area"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
    </label>

    <div class="sp-chips">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        type="button"
        class="sp-chip"
        @click="input = preset.value"
      >
        {{ preset.label }}
      </button>
    </div>

    <SpMathLoading v-if="outcome.status === 'loading'" />

    <SpMathError
      v-else-if="outcome.status === 'error'"
      :name="outcome.name"
      :message="outcome.message"
    />

    <template v-else-if="outcome.status === 'ok'">
      <p class="sp-system__read">
        <span class="sp-system__label">read as</span>
        <SpTex
          v-for="equation in outcome.value.equations"
          :key="equation"
          :tex="equation"
        />
      </p>

      <p class="sp-system__answer" :class="{ 'sp-system__answer--none': !outcome.value.consistent }">
        <span class="sp-system__label">{{ outcome.value.consistent ? "solutions" : "verdict" }}</span>
        <template v-if="outcome.value.consistent">
          <SpTex v-for="row in rows" :key="row" :tex="row" />
        </template>
        <span v-else>no solution — the equations contradict each other</span>
      </p>

      <SpMathSteps
        :steps="outcome.value.steps"
        empty="No elimination chain: the solver narrates the systems it has a strategy for, and answers the rest without one."
      />
    </template>

    <template #hint>
      <code>consistent: false</code> with <code>solutions: null</code> is an answer about the
      system, not a failure of the call — so a contradictory set still returns, with whatever
      working got there.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-system__read,
.sp-system__answer {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 14px;
  margin: 0 0 12px;
}

.sp-system__answer {
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-size: 17px;
}

.sp-system__answer--none {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.sp-system__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}
</style>
