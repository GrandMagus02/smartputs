<script setup lang="ts">
import { BUILTIN_KINDS } from "@smartput/kinds";
import { computed, ref } from "vue";
import { docsEngine, evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

/**
 * The unit keys off the registered kind, so this list cannot drift from what
 * the engine will actually accept.
 */
const kind = BUILTIN_KINDS.find((k) => k.id === "duration");
const units = kind?.value.mode === "ratio" ? Object.keys(kind.value.units) : [];

const amount = ref("90");
const from = ref("min");
const to = ref("h");

const expression = computed(() => `${amount.value} ${from.value} in ${to.value}`);
const outcome = computed(() => evaluateSafely(docsEngine, expression.value));

/** Arithmetic rather than conversion — the half a converter cannot show. */
const arithmetic = ref("30 hours - 10 minutes");
const arithmeticOutcome = computed(() => evaluateSafely(docsEngine, arithmetic.value));

const examples = [
  "30 hours - 10 minutes",
  "1 wk + 2 d",
  "90 min + 45 s",
  "2 h * 3",
  "1 d / 4",
];
</script>

<template>
  <DemoShell title="Duration, a plain ratio kind" icon="i-hugeicons-timer-01">
    <div class="sp-duration">
      <label class="sp-field">
        <span class="sp-field__label">Amount</span>
        <input v-model="amount" type="text" inputmode="decimal" class="sp-input sp-input--num" />
      </label>
      <label class="sp-field">
        <span class="sp-field__label">From</span>
        <select v-model="from" class="sp-input">
          <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </label>
      <label class="sp-field">
        <span class="sp-field__label">To</span>
        <select v-model="to" class="sp-input">
          <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
        </select>
      </label>
    </div>

    <pre class="sp-code">engine.evaluate({{ JSON.stringify(expression) }})</pre>

    <SpResult :outcome="outcome" />

    <h5 class="sp-duration__rule">…and it does arithmetic without a calendar</h5>

    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="arithmetic"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
    </label>

    <div class="sp-chips">
      <button
        v-for="example in examples"
        :key="example"
        type="button"
        class="sp-chip"
        @click="arithmetic = example"
      >
        {{ example }}
      </button>
    </div>

    <SpResult :outcome="arithmeticOutcome" compact />

    <template #hint>
      Every result on this page came out of an engine that has never heard of
      <code>@smartput/datetime</code>. <code>duration</code> ships in
      <code>@smartput/kinds</code> because it is a pure ratio kind — canonical
      seconds, no Temporal, no time zone, no DST — and <code>1 wk + 2 d</code>
      is the same arithmetic as <code>1 kg + 500 g</code>. Only
      <code>datetime</code>, where the calendar is genuinely hard, pulls the
      heavy dependencies.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-duration {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  align-items: end;
  margin-bottom: 12px;
}

.sp-duration .sp-field {
  margin-bottom: 0;
}

.sp-duration select.sp-input {
  appearance: none;
  cursor: pointer;
}

.sp-duration__rule {
  margin: 20px 0 12px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-2);
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

@media (max-width: 520px) {
  .sp-duration {
    grid-template-columns: 1fr;
  }
}
</style>
