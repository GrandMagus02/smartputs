<script setup lang="ts">
import { computed, ref } from "vue";
import { attempt, useMath } from "../math";
import DemoShell from "./DemoShell.vue";
import SpMathError from "./SpMathError.vue";
import SpMathLoading from "./SpMathLoading.vue";
import SpTex from "./SpTex.vue";

const EXAMPLES = ["x^2-4", "x^3-3x", "x^2+1", "\\frac{1}{x}", "x^3", "x^2+x"];

const input = ref("x^2-4");
const math = useMath();
const outcome = computed(() =>
  attempt(math.value, input.value, (engine) => engine.analyze(input.value)),
);

const KIND_ICON: Record<string, string> = {
  minimum: "i-lucide-trending-down",
  maximum: "i-lucide-trending-up",
  inflection: "i-lucide-move-horizontal",
  unknown: "i-lucide-circle-help",
};
</script>

<template>
  <DemoShell title="math.analyze(latex, options?)" icon="i-lucide-chart-spline">
    <label class="sp-field">
      <span class="sp-field__label">Function of one variable</span>
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

    <dl v-else-if="outcome.status === 'ok'" class="sp-analyze">
      <div>
        <dt>roots</dt>
        <dd>
          <template v-if="outcome.value.roots.length">
            <SpTex v-for="root in outcome.value.roots" :key="root" :tex="root" />
          </template>
          <em v-else>none on the real line</em>
        </dd>
      </div>

      <div v-if="outcome.value.complexRoots.length">
        <dt>complex roots</dt>
        <dd>
          <SpTex v-for="root in outcome.value.complexRoots" :key="root" :tex="root" />
        </dd>
      </div>

      <div>
        <dt>value at zero</dt>
        <dd>
          <SpTex v-if="outcome.value.valueAtZero" :tex="outcome.value.valueAtZero" />
          <em v-else>undefined there</em>
        </dd>
      </div>

      <div>
        <dt>derivative</dt>
        <dd><SpTex :tex="outcome.value.derivative" /></dd>
      </div>

      <div>
        <dt>second derivative</dt>
        <dd><SpTex :tex="outcome.value.secondDerivative" /></dd>
      </div>

      <div>
        <dt>turning points</dt>
        <dd>
          <template v-if="outcome.value.turningPoints.length">
            <span
              v-for="point in outcome.value.turningPoints"
              :key="point.at"
              class="sp-analyze__point"
            >
              <span :class="KIND_ICON[point.kind]" aria-hidden="true" />
              <SpTex :tex="`(${point.at},\\ ${point.value})`" />
              <small>{{ point.kind }}</small>
            </span>
          </template>
          <em v-else>none</em>
        </dd>
      </div>

      <div>
        <dt>parity</dt>
        <dd><code>{{ outcome.value.parity }}</code></dd>
      </div>
    </dl>

    <template #hint>
      Every answer is exact where the solver has an exact method. Past that it falls back to
      numerical roots — try <code>x^3-3x</code>, whose roots are ±√3 and come back as decimals.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-analyze {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  margin: 0;
}

.sp-analyze > div {
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.sp-analyze dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-analyze dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin: 4px 0 0;
  font-size: 15px;
}

.sp-analyze em {
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.sp-analyze__point {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sp-analyze__point small {
  font-size: 11px;
  color: var(--vp-c-text-3);
}
</style>
