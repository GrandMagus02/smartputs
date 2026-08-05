<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpMathSteps from "./SpMathSteps.vue";
import SpTex from "./SpTex.vue";

withDefaults(
  defineProps<{
    examples?: string[];
    hint?: string;
  }>(),
  { examples: () => [] },
);

const input = ref("x^2-5x+6=0");
/** Blank means "infer it" — which the engine does whenever there is one unknown. */
const variable = ref("");

const math = useMath();

const outcome = computed(() =>
  attempt(math.value, input.value, (engine) =>
    engine.solve(
      input.value,
      variable.value.trim() === "" ? {} : { variable: variable.value.trim() },
    ),
  ),
);
</script>

<template>
  <DemoShell title="math.solve(latex, options?)" icon="i-lucide-equal" :hint="hint">
    <div class="sp-solve">
      <label class="sp-field">
        <span class="sp-field__label">Equation</span>
        <input
          v-model="input"
          type="text"
          class="sp-input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
        />
      </label>

      <label class="sp-field">
        <span class="sp-field__label">Solve for</span>
        <input
          v-model="variable"
          type="text"
          class="sp-input sp-input--sm"
          placeholder="auto"
          spellcheck="false"
        />
      </label>
    </div>

    <div v-if="examples.length" class="sp-chips">
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

    <SpMathLoading v-if="outcome.status === 'loading'" />

    <SpMathError
      v-else-if="outcome.status === 'error'"
      :name="outcome.name"
      :message="outcome.message"
    />

    <template v-else-if="outcome.status === 'ok'">
      <p class="sp-solve__answer">
        <span class="sp-solve__label">solutions</span>
        <template v-if="outcome.value.solutions.length">
          <SpTex
            v-for="solution in outcome.value.solutions"
            :key="solution"
            :tex="`${outcome.value.variable}=${solution}`"
          />
        </template>
        <em v-else>none</em>
      </p>
      <SpMathSteps :steps="outcome.value.steps" />
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-solve {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
  align-items: end;
}

.sp-solve .sp-field {
  margin-bottom: 12px;
}

.sp-solve__answer {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 14px;
  margin: 0 0 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-size: 17px;
}

.sp-solve__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

@media (max-width: 620px) {
  .sp-solve {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
