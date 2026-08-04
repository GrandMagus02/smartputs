<script setup lang="ts">
import { computed, ref } from "vue";
import { docsEngine, kindIcon } from "../engine";

/**
 * The launcher-style surface from the home hero. It is the same engine the
 * rest of the site uses, driven by `suggest()` so that ambiguous input shows a
 * ranking instead of throwing.
 */
const input = ref("30 hours in seconds");

const EXAMPLES = [
  "30 hours in seconds",
  "1 kg + 500 g",
  "2 km in m",
  "10 m + 5 min",
  "12 inch in cm",
];

/**
 * The left column shows what was asked, not what was typed: for a conversion
 * that is the expression without its target unit, otherwise the whole input.
 */
const CONVERSION = /\s+(?:in|to|as)\s+\S+\s*$/i;

const source = computed(() => {
  const trimmed = input.value.trim();
  const stripped = trimmed.replace(CONVERSION, "");
  return stripped === "" ? trimmed : stripped;
});

const rows = computed(() => {
  if (input.value.trim() === "") return [];
  return docsEngine.suggest(input.value).slice(0, 3);
});

function pick(example: string) {
  input.value = example;
}
</script>

<template>
  <div class="hero-calc">
    <div class="hero-calc__bar">
      <span class="i-lucide-search-code hero-calc__glyph" aria-hidden="true" />
      <input
        v-model="input"
        type="text"
        class="hero-calc__input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        aria-label="Expression"
        placeholder="30 hours in seconds"
      />
      <kbd class="hero-calc__kbd">live</kbd>
    </div>

    <ul v-if="rows.length" class="hero-calc__rows">
      <li
        v-for="(row, i) in rows"
        :key="`${row.kind}-${row.value.unit}-${i}`"
        :class="{ 'is-top': i === 0 }"
      >
        <span :class="kindIcon(row.kind)" class="hero-calc__kindicon" aria-hidden="true" />
        <span class="hero-calc__src">{{ source }}</span>
        <span class="hero-calc__eq" aria-hidden="true">=</span>
        <span class="hero-calc__out">{{ row.formatted }}</span>
      </li>
    </ul>

    <div v-else class="hero-calc__rows hero-calc__rows--empty">
      <span class="i-lucide-circle-alert" aria-hidden="true" />
      <span>No reading for that input.</span>
    </div>

    <div class="hero-calc__chips">
      <button v-for="example in EXAMPLES" :key="example" type="button" @click="pick(example)">
        {{ example }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero-calc {
  width: 100%;
  max-width: 460px;
  border-radius: 16px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  overflow: hidden;
  text-align: left;
}

.hero-calc__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.hero-calc__glyph {
  color: var(--vp-c-text-3);
  flex: none;
}

.hero-calc__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  line-height: 1.5;
}

.hero-calc__input::placeholder {
  color: var(--vp-c-text-3);
}

.hero-calc__kbd {
  flex: none;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.hero-calc__rows {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 64px;
}

.hero-calc__rows li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 14px minmax(0, 1fr);
  align-items: baseline;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
}

.hero-calc__rows li.is-top {
  background: var(--vp-c-default-soft);
}

.hero-calc__kindicon {
  color: var(--vp-c-text-3);
  align-self: center;
}

.hero-calc__src {
  color: var(--vp-c-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-calc__eq {
  color: var(--vp-c-text-3);
  text-align: center;
}

.hero-calc__out {
  color: var(--vp-c-brand-1);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-calc__rows--empty {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 18px 16px;
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.hero-calc__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.hero-calc__chips button {
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  line-height: 1.7;
  transition: color 0.2s, border-color 0.2s;
}

.hero-calc__chips button:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

@media (max-width: 960px) {
  .hero-calc {
    max-width: none;
    margin: 8px auto 0;
  }
}
</style>
