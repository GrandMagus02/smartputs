<script setup lang="ts">
import { computed, ref } from "vue";
import { round4Text } from "../display";
import { docsEngine, kindIcon } from "../engine";
import { useCompletions } from "../useCompletions";
import SpCompletionList from "./SpCompletionList.vue";

/**
 * The launcher-style surface from the home hero. It is the same engine the
 * rest of the site uses, driven by `suggest()` so that ambiguous input shows a
 * ranking instead of throwing, and by `complete()` so a half-typed unit offers
 * the units it could still become.
 */
const input = ref("30 hours in sec");

const EXAMPLES = [
  "30 hours in sec",
  "1 kg + 500 g",
  "2 km in m",
  "10 m + 5 min",
  "12 inch in cm",
];

const completions = useCompletions({ engine: docsEngine, input, limit: 5 });

function onKeydown(event: KeyboardEvent) {
  if (completions.onKeydown(event)) event.preventDefault();
}

const CONVERSION = /\s+(?:in|to|as)\s+\S+\s*$/i;

/** `suggest()` over text that may not parse — a half-typed unit is not an error. */
function readingsOf(text: string) {
  if (text.trim() === "") return [];
  try {
    return docsEngine.suggest(text).slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * A reading for whatever is on screen, finished or not.
 *
 * Three sources, in that order: the completion under the cursor while the list
 * is open, so ↑/↓ previews what accepting a row would evaluate to; the input
 * itself, once it parses; and failing both, the longest prefix that still
 * reads — "1 kg + 500" has no answer, "1 kg" does. `partial` says the numbers
 * below are a reading of something other than what is in the box, because a
 * result for text the user has not typed yet has to say so.
 */
const reading = computed(() => {
  const typed = input.value.trim();
  if (typed === "") return { text: "", rows: [], partial: false };

  const row = completions.open.value
    ? completions.rows.value[completions.active.value]
    : undefined;
  if (row !== undefined) {
    const completed = readingsOf(row.text);
    if (completed.length > 0) {
      return { text: row.text, rows: completed, partial: row.text !== typed };
    }
  }

  const direct = readingsOf(typed);
  if (direct.length > 0) return { text: typed, rows: direct, partial: false };

  const words = typed.split(/\s+/);
  for (let count = words.length - 1; count > 0; count -= 1) {
    const prefix = words.slice(0, count).join(" ");
    const shorter = readingsOf(prefix);
    if (shorter.length > 0) return { text: prefix, rows: shorter, partial: true };
  }

  return { text: typed, rows: [], partial: false };
});

/** Two rows rather than three while the list is open, so the card holds its size. */
const rows = computed(() => reading.value.rows.slice(0, completions.open.value ? 2 : 3));

/**
 * The left column shows what was asked, not what was typed: for a conversion
 * that is the expression without its target unit, otherwise the whole reading.
 */
const source = computed(() => {
  const text = reading.value.text;
  const stripped = text.replace(CONVERSION, "");
  return stripped === "" ? text : stripped;
});

function pick(example: string) {
  input.value = example;
}
</script>

<template>
  <div class="hero-calc">
    <div class="hero-calc__bar">
      <span class="i-hugeicons-search-code hero-calc__glyph" aria-hidden="true" />
      <input
        v-model="input"
        type="text"
        class="hero-calc__input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        role="combobox"
        :aria-expanded="completions.open.value"
        aria-controls="hero-calc-completions"
        aria-label="Expression"
        placeholder="30 hours in sec"
        @keydown="onKeydown"
      />
      <kbd class="hero-calc__kbd">live</kbd>
    </div>

    <!-- Completion and evaluation are one surface, not two modes: the units a
         half-typed word could still become, and under them what the engine
         already reads — of the row under the cursor, or of the part of the
         sentence that is finished. -->
    <div
      v-if="completions.open.value"
      id="hero-calc-completions"
      class="hero-calc__completions"
    >
      <SpCompletionList
        dense
        :rows="completions.rows.value"
        :active="completions.active.value"
        :input="input"
        @pick="completions.accept"
      />
      <p class="hero-calc__tabhint">
        <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Tab</kbd> to complete
      </p>
    </div>

    <div class="hero-calc__result" :class="{ 'is-under': completions.open.value }">
      <p v-if="rows.length && reading.partial" class="hero-calc__partial">
        reading <code>{{ reading.text }}</code>
      </p>

      <ul v-if="rows.length" class="hero-calc__rows">
        <li
          v-for="(row, i) in rows"
          :key="`${row.kind}-${row.value.unit}-${i}`"
          :class="{ 'is-top': i === 0 }"
        >
          <span :class="kindIcon(row.kind)" class="hero-calc__kindicon" aria-hidden="true" />
          <span class="hero-calc__src">{{ source }}</span>
          <span class="hero-calc__eq" aria-hidden="true">=</span>
          <span class="hero-calc__out">{{ round4Text(row.formatted) }}</span>
        </li>
      </ul>

      <div v-else class="hero-calc__rows hero-calc__rows--empty">
        <span class="i-hugeicons-alert-circle" aria-hidden="true" />
        <span>No reading for that input yet.</span>
      </div>
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

/* Matches the rows' min-height, so accepting a completion does not resize the
   hero under the pointer. */
.hero-calc__completions {
  min-height: 64px;
}

/* The readings sit under the completions rather than instead of them, so the
   two need a rule between them. */
.hero-calc__result.is-under {
  border-top: 1px solid var(--vp-c-divider);
}

/* Says the numbers below are a reading of something other than what is in the
   box — the completion under the cursor, or the finished part of the line. */
.hero-calc__partial {
  margin: 0;
  padding: 8px 12px 0;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.hero-calc__partial code {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-2);
  background: none;
  padding: 0;
}

.hero-calc__result.is-under .hero-calc__rows {
  min-height: 0;
  padding-top: 4px;
}

.hero-calc__tabhint {
  margin: 0;
  padding: 0 12px 8px;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.hero-calc__tabhint kbd {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
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
