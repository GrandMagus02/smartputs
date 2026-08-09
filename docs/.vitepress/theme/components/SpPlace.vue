<script setup lang="ts">
import type { PlaceMeta } from "@smartput/core";
import { computed, ref } from "vue";
import { COUNTRIES, evaluateSafely, placeEngine } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

/** The shipped table itself — the demo has no country list of its own. */
const names = COUNTRIES.map((row) => row.name);

/**
 * The selects are keyed by the display name, so a default has to be one — the
 * row's `name` is "Japan" and a lowercase `"japan"` matches no `<option>`,
 * which renders as an empty select rather than as a wrong one.
 */
const nameOf = (a2: string) =>
  COUNTRIES.find((row) => row.a2 === a2)?.name ?? (names[0] as string);

const input = ref("japan");
const from = ref(nameOf("jp"));
const to = ref(nameOf("fr"));

const outcome = computed(() => evaluateSafely(placeEngine, input.value));
const pair = computed(() => `${from.value} to ${to.value}`);
const distance = computed(() => evaluateSafely(placeEngine, pair.value));

/**
 * The facts come off the Value's `meta`, which is exactly where the datetime
 * and rates bridges read them — so this panel is showing the same two strings
 * that make `3pm in japan` and `100 usd in japan` work.
 */
const meta = computed(() =>
  outcome.value.status === "ok" && outcome.value.result.kind === "place"
    ? (outcome.value.result.value.meta as PlaceMeta | undefined)
    : undefined,
);

const examples = [
  "japan",
  "united kingdom",
  "great britain",
  "SW1A 1AA",
  "us 90210",
  "90210",
];
</script>

<template>
  <DemoShell title="A country is a value" icon="i-lucide-map-pin">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        list="sp-countries"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="e.g. ukraine"
      />
    </label>

    <datalist id="sp-countries">
      <option v-for="name in names" :key="name" :value="name" />
    </datalist>

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

    <SpResult :outcome="outcome" />

    <dl v-if="meta" class="sp-place__meta">
      <div>
        <dt>meta.zone</dt>
        <dd><code>{{ meta.zone }}</code></dd>
      </div>
      <div>
        <dt>meta.currency</dt>
        <dd><code>{{ meta.currency || "—" }}</code></dd>
      </div>
      <div>
        <dt>meta.lat, lon</dt>
        <dd><code>{{ meta.lat }}, {{ meta.lon }}</code></dd>
      </div>
    </dl>

    <h5 class="sp-place__rule">…and two of them are a distance</h5>

    <div class="sp-place__pair">
      <label class="sp-field">
        <span class="sp-field__label">From</span>
        <select v-model="from" class="sp-input">
          <option v-for="name in names" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <span class="sp-place__arrow i-lucide-arrow-right" aria-hidden="true" />
      <label class="sp-field">
        <span class="sp-field__label">To</span>
        <select v-model="to" class="sp-input">
          <option v-for="name in names" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
    </div>

    <pre class="sp-code">engine.evaluate({{ JSON.stringify(pair) }})</pre>

    <SpResult :outcome="distance" compact />

    <template #hint>
      252 countries, no cities — this engine registers
      <code>place</code> at T0, which is 27 KB. The distance is great-circle
      between the two capitals and comes back as a <code>length</code>, so
      <code>@smartput/length</code> has to be registered beside it; the result
      carries a <code>great-circle</code> assumption because driving distance is
      what a person often means and no free dataset has it.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-place__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0 0;
}

.sp-place__meta dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-place__meta dd {
  margin: 2px 0 0;
}

.sp-place__meta code {
  font-size: 12px;
  word-break: break-all;
}

.sp-place__rule {
  margin: 20px 0 12px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-2);
}

.sp-place__pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  gap: 10px;
  margin-bottom: 12px;
}

.sp-place__pair .sp-field {
  margin-bottom: 0;
}

.sp-place__pair select.sp-input {
  appearance: none;
  cursor: pointer;
}

.sp-place__arrow {
  height: 36px;
  display: flex;
  align-items: center;
  color: var(--vp-c-text-3);
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

@media (max-width: 620px) {
  .sp-place__pair {
    grid-template-columns: 1fr;
  }
  .sp-place__arrow {
    height: auto;
    transform: rotate(90deg);
  }
}
</style>
