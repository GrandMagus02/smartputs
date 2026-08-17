<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpTex from "./SpTex.vue";

const PRESETS: { label: string; value: string }[] = [
  { label: "2×2", value: "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}" },
  { label: "singular", value: "\\begin{pmatrix}1&2\\\\2&4\\end{pmatrix}" },
  { label: "3×3", value: "\\begin{pmatrix}1&2&3\\\\4&5&6\\\\7&8&10\\end{pmatrix}" },
  { label: "2×3", value: "\\begin{pmatrix}1&2&3\\\\4&5&6\\end{pmatrix}" },
  { label: "column", value: "\\begin{pmatrix}1\\\\2\\end{pmatrix}" },
];

const input = ref(PRESETS[0]?.value ?? "");
const math = useMath();
const outcome = computed(() =>
  attempt(math.value, input.value, (engine) => engine.matrix(input.value)),
);

/** Matrix arithmetic goes through `evaluate`, and comes back as a matrix. */
const productInput = computed(
  () => `${input.value}\\cdot\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}`,
);
const product = computed(() =>
  attempt(math.value, productInput.value, (engine) =>
    engine.evaluate(productInput.value),
  ),
);
</script>

<template>
  <DemoShell title="math.matrix(latex)" icon="i-hugeicons-grid">
    <label class="sp-field">
      <span class="sp-field__label">Matrix — <code>pmatrix</code>, <code>bmatrix</code> or a list of rows</span>
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
      <div class="sp-matrix__row">
        <figure class="sp-matrix__cell">
          <figcaption>matrix — {{ outcome.value.rows }} × {{ outcome.value.columns }}</figcaption>
          <SpTex :tex="outcome.value.latex" display />
        </figure>

        <figure class="sp-matrix__cell">
          <figcaption>transpose</figcaption>
          <SpTex :tex="outcome.value.transpose" display />
        </figure>

        <figure class="sp-matrix__cell">
          <figcaption>inverse</figcaption>
          <SpTex v-if="outcome.value.inverse" :tex="outcome.value.inverse" display />
          <em v-else-if="outcome.value.isSingular">singular — no inverse</em>
          <em v-else>not square — no inverse</em>
        </figure>

        <figure
          v-if="product.status === 'ok'"
          class="sp-matrix__cell"
        >
          <figcaption>evaluate(M · swap)</figcaption>
          <SpTex :tex="product.value.latex" display />
        </figure>
      </div>

      <dl class="sp-matrix__meta">
        <div>
          <dt>determinant</dt>
          <dd>
            <SpTex v-if="outcome.value.determinant" :tex="outcome.value.determinant" />
            <em v-else>not square</em>
          </dd>
        </div>
        <div>
          <dt>trace</dt>
          <dd>
            <SpTex v-if="outcome.value.trace" :tex="outcome.value.trace" />
            <em v-else>not square</em>
          </dd>
        </div>
        <div>
          <dt>square</dt>
          <dd><code>{{ outcome.value.isSquare }}</code></dd>
        </div>
        <div>
          <dt>singular</dt>
          <dd><code>{{ String(outcome.value.isSingular) }}</code></dd>
        </div>
      </dl>
    </template>

    <template #hint>
      Entries stay exact — the inverse of the 2×2 holds <code>\frac{3}{2}</code>, not
      <code>1.5</code> — and results come back in <code>pmatrix</code> notation rather than as
      nested lists. A singular matrix reports <code>inverse: null</code> instead of echoing the
      request back unevaluated.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-matrix__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.sp-matrix__cell {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow-x: auto;
}

.sp-matrix__cell figcaption {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
  margin-bottom: 6px;
}

.sp-matrix__cell em {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.sp-matrix__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 0;
}

.sp-matrix__meta dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-matrix__meta dd {
  margin: 2px 0 0;
  font-size: 15px;
}
</style>
