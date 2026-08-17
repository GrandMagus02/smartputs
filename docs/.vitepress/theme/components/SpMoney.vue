<script setup lang="ts">
import { computed, ref } from "vue";
import { round4 } from "../display";
import { CURRENCIES, DOCS_RATES, evaluateSafely, moneyEngine } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

/** Straight off the kind's own currency table — not a copy kept in the docs. */
const codes = Object.keys(CURRENCIES);

const amount = ref("30");
const from = ref("usd");
const to = ref("eur");

const expression = computed(() => `${amount.value} ${from.value} in ${to.value}`);
const outcome = computed(() => evaluateSafely(moneyEngine, expression.value));

function swap() {
  const held = from.value;
  from.value = to.value;
  to.value = held;
}

function label(code: string): string {
  const def = CURRENCIES[code];
  return def === undefined ? code : `${def.symbol}  ${code.toUpperCase()}`;
}

/**
 * What one unit of `from` is worth in `to`, read from the same snapshot the
 * engine used. Shown because a converter that only prints a total hides
 * whether the rate or the arithmetic is what surprised you.
 */
const unitRate = computed(() => {
  const rate = DOCS_RATES.get(from.value.toUpperCase(), to.value.toUpperCase());
  return rate === null ? null : round4(rate);
});
</script>

<template>
  <DemoShell title="Money, with an injected rate table" icon="i-hugeicons-money-01">
    <div class="sp-money">
      <label class="sp-field">
        <span class="sp-field__label">Amount</span>
        <input v-model="amount" type="text" inputmode="decimal" class="sp-input sp-input--num" />
      </label>

      <label class="sp-field">
        <span class="sp-field__label">From</span>
        <select v-model="from" class="sp-input">
          <option v-for="code in codes" :key="code" :value="code">{{ label(code) }}</option>
        </select>
      </label>

      <button type="button" class="sp-money__swap" title="Swap currencies" @click="swap">
        <span class="i-hugeicons-arrow-left-right" aria-hidden="true" />
        <span class="sr-only">Swap</span>
      </button>

      <label class="sp-field">
        <span class="sp-field__label">To</span>
        <select v-model="to" class="sp-input">
          <option v-for="code in codes" :key="code" :value="code">{{ label(code) }}</option>
        </select>
      </label>
    </div>

    <pre class="sp-code">engine.evaluate({{ JSON.stringify(expression) }})</pre>

    <SpResult :outcome="outcome" />

    <dl class="sp-money__meta">
      <div>
        <dt>rate</dt>
        <dd>
          <code v-if="unitRate">1 {{ from.toUpperCase() }} = {{ unitRate }} {{ to.toUpperCase() }}</code>
          <code v-else>no quote</code>
        </dd>
      </div>
      <div>
        <dt>as of</dt>
        <dd><code>{{ DOCS_RATES.asOf }}</code></dd>
      </div>
      <div>
        <dt>base</dt>
        <dd><code>{{ DOCS_RATES.base }}</code></dd>
      </div>
    </dl>

    <template #hint>
      These are a checked-in snapshot, not live quotes — a static site cannot
      reach the ECB endpoint. Swap to a pair that is not quoted against the euro
      and the result carries a <code>cross-rate</code> assumption: the rate was
      derived through the base, and the engine says so rather than implying a
      precision it does not have.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-money {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 10px;
  margin-bottom: 12px;
}

.sp-money .sp-field {
  margin-bottom: 0;
}

.sp-money select.sp-input {
  appearance: none;
  cursor: pointer;
}

.sp-money__swap {
  height: 36px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  transition:
    color 0.2s,
    border-color 0.2s;
}

.sp-money__swap:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
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

.sp-money__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0 0;
}

.sp-money__meta dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-money__meta dd {
  margin: 2px 0 0;
}

.sp-money__meta code {
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 620px) {
  .sp-money {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .sp-money__swap {
    justify-self: start;
  }
}
</style>
