<script setup lang="ts">
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { computed, ref } from "vue";
import { datetimeEngine, evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

/**
 * Straight off the shipped table, not a copy: the first alias of each zone is
 * the word a person types, and the symbol is what the formatter prints.
 */
const zones = Object.entries(ZONES).map(([id, def]) => ({
  id,
  alias: def.aliases[0] as string,
  symbol: def.symbol,
}));

/**
 * The offset zones, whose "alias" is the run a person writes rather than a
 * word in the index — `gmt+03:00` reaches the kind through its literal matcher,
 * because an offset lexes as three tokens and no alias lookup could find it.
 */
const offsets = Object.entries(OFFSET_ZONES).map(([id, def]) => ({
  id,
  alias: `gmt${id}`,
  symbol: def.symbol,
}));

const input = ref("3pm");
const target = ref("");

const expression = computed(() =>
  target.value === "" ? input.value : `${input.value} in ${target.value}`,
);
const outcome = computed(() => evaluateSafely(datetimeEngine, expression.value));

/**
 * `meta.iso` is where the zone and the wall clock ride — the `Temporal` object
 * is never stored on the Value — so showing it is showing the whole of what a
 * conversion changed, next to a `canonical` that did not move.
 */
const iso = computed(() =>
  outcome.value.status === "ok"
    ? ((outcome.value.result.value.meta as { iso?: string } | undefined)?.iso ?? "")
    : "",
);

const examples = [
  "today",
  "next friday",
  "3pm",
  "in 3 days",
  "3 days ago",
  "today + 3 d",
  "tomorrow - today",
  "3pm in japan",
  "3pm gmt+3",
  "GMT+5:30",
];
</script>

<template>
  <DemoShell title="Dates, times and zones" icon="i-hugeicons-date-time">
    <div class="sp-dt">
      <label class="sp-field">
        <span class="sp-field__label">Expression</span>
        <input
          v-model="input"
          type="text"
          class="sp-input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          placeholder="e.g. next friday"
        />
      </label>

      <label class="sp-field">
        <span class="sp-field__label">Convert to</span>
        <select v-model="target" class="sp-input">
          <option value="">— leave as written —</option>
          <optgroup label="Named zones">
            <option v-for="zone in zones" :key="zone.id" :value="zone.alias">
              {{ zone.alias }} · {{ zone.symbol }}
            </option>
          </optgroup>
          <optgroup label="Written offsets">
            <option v-for="zone in offsets" :key="zone.id" :value="zone.alias">
              {{ zone.alias }} · {{ zone.symbol }}
            </option>
          </optgroup>
        </select>
      </label>
    </div>

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

    <pre class="sp-code">engine.evaluate({{ JSON.stringify(expression) }})</pre>

    <!-- Client-only because the clock is live: the server renders this page at
         build time and the browser evaluates it now, so `today` would be two
         different days and hydration would report a mismatch on every visit. -->
    <ClientOnly>
      <SpResult :outcome="outcome" />

      <dl v-if="iso" class="sp-dt__meta">
        <div>
          <dt>meta.iso</dt>
          <dd><code>{{ iso }}</code></dd>
        </div>
      </dl>
    </ClientOnly>

    <template #hint>
      The clock is live, so <code>today</code> is today. Converting keeps the
      instant and relabels the wall clock — pick a zone and watch
      <code>canonical</code> stay where it was while <code>meta.iso</code> moves.
      <code>3pm in japan</code> works because this engine also registers the
      place kind: datetime reads <code>meta.zone</code> off a place value, and
      neither package imports the other. A zone written as an offset —
      <code>gmt+3</code>, <code>utc-05:30</code> — works everywhere a zone name
      does, and comes from <code>@smartput/timezone</code>, which is tables and
      a regex with no dependencies.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-dt {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 10px;
  align-items: end;
  margin-bottom: 12px;
}

.sp-dt .sp-field {
  margin-bottom: 0;
}

.sp-dt select.sp-input {
  appearance: none;
  cursor: pointer;
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

.sp-dt__meta {
  margin: 12px 0 0;
}

.sp-dt__meta dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-dt__meta dd {
  margin: 2px 0 0;
}

.sp-dt__meta code {
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 620px) {
  .sp-dt {
    grid-template-columns: 1fr;
  }
}
</style>
