<script setup lang="ts">
import { computed, ref } from "vue";
import { COUNTRIES, POSTAL_FORMATS } from "../engine";
import DemoShell from "./DemoShell.vue";

/**
 * The 178 rows that have a format, asked of the table itself rather than
 * filtered on a copy of the column: `for` returns `null` both for a country
 * that does not exist and for one whose format is empty or refused by the
 * backtracking screen, and that is exactly the set worth offering.
 */
const countries = COUNTRIES.filter((row) => POSTAL_FORMATS.for(row.a2) !== null).map(
  (row) => ({ a2: row.a2, name: row.name }),
);

const country = ref("gb");
const code = ref("sw1a1aa");

const format = computed(() => POSTAL_FORMATS.for(country.value));
const normalized = computed(() => format.value?.normalize(code.value) ?? null);
const valid = computed(() => format.value?.validate(code.value) ?? false);
const shape = computed(() => format.value?.shape(code.value) ?? null);

const samples: Record<string, string> = {
  gb: "sw1a1aa",
  ca: "m5v3l9",
  nl: "1234ab",
  jp: "1000001",
  us: "902101234",
  ie: "d02af30",
  pt: "1234-567 lisboa",
};

function pick(a2: string): void {
  country.value = a2;
  code.value = samples[a2] ?? code.value;
}
</script>

<template>
  <DemoShell title="Validating a postal code" icon="i-lucide-mailbox">
    <div class="sp-postal">
      <label class="sp-field">
        <span class="sp-field__label">Country</span>
        <select v-model="country" class="sp-input">
          <option v-for="row in countries" :key="row.a2" :value="row.a2">
            {{ row.name }} · {{ row.a2.toUpperCase() }}
          </option>
        </select>
      </label>

      <label class="sp-field">
        <span class="sp-field__label">Code</span>
        <input
          v-model="code"
          type="text"
          class="sp-input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="characters"
          placeholder="e.g. sw1a1aa"
        />
      </label>
    </div>

    <div class="sp-chips">
      <button
        v-for="(sample, a2) in samples"
        :key="a2"
        type="button"
        class="sp-chip"
        @click="pick(a2)"
      >
        {{ a2.toUpperCase() }} {{ sample }}
      </button>
    </div>

    <pre class="sp-code">POSTAL_FORMATS.for({{ JSON.stringify(country.toUpperCase()) }}).normalize({{ JSON.stringify(code) }})</pre>

    <div class="sp-postal__verdict" :class="valid ? 'is-ok' : 'is-bad'">
      <span :class="valid ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" aria-hidden="true" />
      <strong>{{ normalized ?? "no spelling of this code is valid here" }}</strong>
    </div>

    <dl class="sp-postal__meta">
      <div>
        <dt>validate</dt>
        <dd><code>{{ valid }}</code></dd>
      </div>
      <div>
        <dt>shape</dt>
        <dd><code>{{ shape ?? "—" }}</code></dd>
      </div>
      <div>
        <dt>source</dt>
        <dd><code>{{ format?.source ?? "—" }}</code></dd>
      </div>
    </dl>

    <template #hint>
      Case and separators are repaired by a <em>search</em>, not by a table of
      per-country rules: the code is stripped bare and the country's own format
      is offered each single reinsertion until one is accepted, which is how
      <code>m5v3l9</code>, <code>1234ab</code> and <code>902101234</code> each
      land their separator somewhere different. <code>validate</code> is defined
      as <code>normalize(code) !== null</code>, so a field can never accept a
      code it then fails to canonicalize. <code>source</code> is GeoNames'
      column verbatim — uncompiled and still anchored — for wiring an HTML
      <code>pattern=</code> attribute or a check on a server that has never
      heard of this package.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-postal {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 10px;
  align-items: end;
  margin-bottom: 12px;
}

.sp-postal .sp-field {
  margin-bottom: 0;
}

.sp-postal select.sp-input {
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

.sp-postal__verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.sp-postal__verdict.is-ok {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.sp-postal__verdict.is-bad {
  color: var(--vp-c-text-2);
}

.sp-postal__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin: 12px 0 0;
}

.sp-postal__meta dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-postal__meta dd {
  margin: 2px 0 0;
}

.sp-postal__meta code {
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 620px) {
  .sp-postal {
    grid-template-columns: 1fr;
  }
}
</style>
