<script setup lang="ts">
import { BUILTIN_KINDS } from "@smartput/kinds";
import { computed, ref } from "vue";
import { docsEngine, evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

/** Unit keys straight off the registered kind descriptors, not a copy. */
const unitsByKind = BUILTIN_KINDS.filter((kind) => kind.id !== "number").map((kind) => ({
  id: kind.id,
  units: kind.value.mode === "ratio" ? Object.keys(kind.value.units) : [],
}));

const allUnits = unitsByKind.flatMap((entry) => entry.units);

const amount = ref("2");
const from = ref("km");
const to = ref("mi");

const expression = computed(() => `${amount.value} ${from.value} in ${to.value}`);
const outcome = computed(() => evaluateSafely(docsEngine, expression.value));
</script>

<template>
  <DemoShell title="Conversion with the `in` keyword" icon="i-lucide-move-horizontal">
    <div class="sp-convert">
      <label class="sp-field">
        <span class="sp-field__label">Amount</span>
        <input v-model="amount" type="text" inputmode="decimal" class="sp-input" />
      </label>
      <label class="sp-field">
        <span class="sp-field__label">From</span>
        <input v-model="from" type="text" class="sp-input" list="sp-units" spellcheck="false" />
      </label>
      <label class="sp-field">
        <span class="sp-field__label">To</span>
        <input v-model="to" type="text" class="sp-input" list="sp-units" spellcheck="false" />
      </label>
    </div>

    <datalist id="sp-units">
      <option v-for="unit in allUnits" :key="unit" :value="unit" />
    </datalist>

    <pre class="sp-code">engine.evaluate({{ JSON.stringify(expression) }})</pre>

    <SpResult :outcome="outcome" />

    <details class="sp-units">
      <summary>Units registered in this engine</summary>
      <dl>
        <template v-for="entry in unitsByKind" :key="entry.id">
          <dt><code>{{ entry.id }}</code></dt>
          <dd>
            <code v-for="unit in entry.units" :key="unit">{{ unit }}</code>
          </dd>
        </template>
      </dl>
    </details>

    <template #hint>
      The result keeps the right-hand unit, but the canonical value never
      changes — conversion is a rebase, not a rounding step.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-convert {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

@media (max-width: 520px) {
  .sp-convert {
    grid-template-columns: 1fr;
  }
}

.sp-code {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  overflow-x: auto;
}

.sp-units {
  margin-top: 12px;
  font-size: 13px;
}

.sp-units summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
}

.sp-units dl {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 10px 0 0;
}

.sp-units dd {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sp-units code {
  font-size: 11px;
}
</style>
