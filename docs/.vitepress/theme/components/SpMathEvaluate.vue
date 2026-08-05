<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpMathSteps from "./SpMathSteps.vue";
import SpTex from "./SpTex.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    hint?: string;
    modelValue?: string;
    examples?: string[];
    /** `simplify` collects like terms; `evaluate` computes a value. */
    mode?: "evaluate" | "simplify";
  }>(),
  {
    title: "math.evaluate(latex)",
    modelValue: "\\frac{1}{2}+\\frac{1}{3}",
    examples: () => [],
    mode: "evaluate",
  },
);

const input = ref(props.modelValue);
const math = useMath();

const outcome = computed(() =>
  attempt(math.value, input.value, (engine) =>
    props.mode === "simplify"
      ? engine.simplify(input.value)
      : engine.evaluate(input.value),
  ),
);

/** Only `evaluate` carries a decimal; `simplify` has no value to approximate. */
const approx = computed(() => {
  if (outcome.value.status !== "ok") return null;
  const value = outcome.value.value;
  return "approx" in value ? value.approx : null;
});
</script>

<template>
  <DemoShell :title="title" icon="i-lucide-sigma" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">LaTeX</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="e.g. \frac{1}{2}+\frac{1}{3}"
      />
    </label>

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

    <p class="sp-math__written">
      <span class="sp-math__label">as written</span>
      <SpTex :tex="input" />
    </p>

    <SpMathLoading v-if="outcome.status === 'loading'" />

    <SpMathError
      v-else-if="outcome.status === 'error'"
      :name="outcome.name"
      :message="outcome.message"
    />

    <template v-else-if="outcome.status === 'ok'">
      <p class="sp-math__answer">
        <SpTex :tex="outcome.value.latex" display />
        <span v-if="approx !== null" class="sp-math__approx">≈ {{ approx }}</span>
      </p>
      <SpMathSteps :steps="outcome.value.steps" />
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-math__written {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
}

.sp-math__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-math__answer {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-size: 18px;
}

.sp-math__approx {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
