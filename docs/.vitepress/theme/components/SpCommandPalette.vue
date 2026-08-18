<script setup lang="ts">
import { computed, ref } from "vue";
import { evaluateSafely, moneyEngine } from "../engine";
import { useCompletions } from "../useCompletions";
import DemoShell from "./DemoShell.vue";

/**
 * The launcher row from /guide/examples/command-palette: one input that is a
 * search box until what is in it evaluates, and an answer row that appears
 * above the search results when it does.
 */
const input = ref("30 usd in gbp");
const completions = useCompletions({ engine: moneyEngine, input, limit: 4 });

/**
 * `evaluate` throws on ambiguity, which for a launcher is a normal keystroke
 * rather than an error — half of "10 m" is a metre and half of it is a minute.
 * The answer row is shown only for a confident reading, and the completion rows
 * carry the rest.
 */
const outcome = computed(() => evaluateSafely(moneyEngine, input.value));

const answer = computed(() =>
  outcome.value.status === "ok" ? outcome.value.result.formatted : null,
);

const copied = ref(false);

async function copy(): Promise<void> {
  if (answer.value === null) return;
  await navigator.clipboard.writeText(answer.value);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1200);
}

function onKeydown(event: KeyboardEvent): void {
  // The completion list gets the arrow keys first; Enter falls through to the
  // answer row only when the list did not consume it.
  if (completions.onKeydown(event)) {
    event.preventDefault();
    return;
  }
  if (event.key === "Enter") void copy();
}

/** Everything else the launcher would run. Static, and deliberately so: a row
    that is not a calculation is somebody else's search index. */
const commands = [
  { icon: "i-hugeicons-folder-01", label: "Open project…" },
  { icon: "i-hugeicons-search-01", label: "Search docs" },
];

const examples = [
  "30 usd in gbp",
  "1 kg + 500 g",
  "2 tb in gb",
  "(1200 / 3) * 2",
  "180 min in h",
];
</script>

<template>
  <DemoShell title="A launcher that answers before it searches" icon="i-hugeicons-computer-terminal-01" overflow>
    <div class="sp-pal">
      <div class="sp-pal__bar">
        <span class="i-hugeicons-search-01 sp-pal__glass" aria-hidden="true" />
        <input
          v-model="input"
          type="text"
          class="sp-pal__input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          role="combobox"
          aria-label="Command palette"
          :aria-expanded="completions.open.value"
          placeholder="Type a command, or a calculation"
          @keydown="onKeydown"
        />
        <kbd class="sp-pal__kbd">⏎ copy</kbd>
      </div>

      <ul class="sp-pal__rows" role="list">
        <li v-if="answer" class="sp-pal__row sp-pal__row--answer">
          <span class="i-hugeicons-calculator" aria-hidden="true" />
          <span class="sp-pal__value">{{ answer }}</span>
          <span class="sp-pal__tag">{{ copied ? "copied" : "answer" }}</span>
        </li>

        <li
          v-for="(row, index) in completions.rows.value"
          :key="row.text"
          class="sp-pal__row"
          :class="{ 'sp-pal__row--on': index === completions.active.value }"
        >
          <span class="i-hugeicons-cursor-text" aria-hidden="true" />
          <span class="sp-pal__value">{{ row.text }}</span>
          <span class="sp-pal__tag">{{ row.kind }}</span>
        </li>

        <li v-for="command in commands" :key="command.label" class="sp-pal__row sp-pal__row--dim">
          <span :class="command.icon" aria-hidden="true" />
          <span class="sp-pal__value">{{ command.label }}</span>
        </li>
      </ul>
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

    <template #hint>
      Two calls per keystroke and no network in either: <code>complete()</code>
      for the rows and <code>evaluate()</code> for the answer, both synchronous.
      The answer row appears only when the reading is unambiguous — that is what
      keeps a launcher from claiming <code>10 m</code> is ten metres while the
      person meant ten minutes.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-pal {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  overflow: hidden;
  margin-bottom: 12px;
}

.sp-pal__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.sp-pal__glass {
  color: var(--vp-c-text-3);
}

.sp-pal__input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 16px;
  line-height: 1.5;
}

.sp-pal__input:focus {
  outline: none;
}

.sp-pal__kbd {
  flex: none;
  padding: 2px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.sp-pal__rows {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.sp-pal__row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
}

.sp-pal__row--answer {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.sp-pal__row--answer .sp-pal__value {
  font-family: var(--vp-font-family-mono);
  font-size: 16px;
  color: var(--vp-c-text-1);
}

.sp-pal__row--on {
  background: var(--vp-c-bg-soft);
}

.sp-pal__row--dim {
  color: var(--vp-c-text-3);
}

.sp-pal__value {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.sp-pal__tag {
  flex: none;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
}
</style>
