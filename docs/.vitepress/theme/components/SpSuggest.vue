<script setup lang="ts">
import { computed, ref } from "vue";
import { round4Text } from "../display";
import { docsEngine, kindIcon } from "../engine";
import DemoShell from "./DemoShell.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    examples?: string[];
    hint?: string;
  }>(),
  {
    modelValue: "10 m",
    examples: () => ["10 m", "10 m + 5 min", "3 lbs", "nonsense"],
    hint: undefined,
  },
);

const input = ref(props.modelValue);

/** `suggest()` never throws — an unparseable input is an empty ranking. */
const ranked = computed(() => {
  if (input.value.trim() === "") return [];
  return docsEngine.suggest(input.value);
});
</script>

<template>
  <DemoShell title="engine.suggest(input)" icon="i-lucide-list-tree" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. 10 m"
      />
    </label>

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

    <ol v-if="ranked.length" class="sp-rank">
      <li v-for="(candidate, i) in ranked" :key="`${candidate.kind}-${candidate.value.unit}-${i}`">
        <span class="sp-rank__pos">{{ i + 1 }}</span>
        <span :class="kindIcon(candidate.kind)" aria-hidden="true" />
        <code class="sp-rank__formatted">{{ round4Text(candidate.formatted) }}</code>
        <span class="sp-rank__kind">{{ candidate.kind }}:{{ candidate.value.unit }}</span>
        <span class="sp-rank__bar" aria-hidden="true">
          <span :style="{ width: `${candidate.confidence * 100}%` }" />
        </span>
        <span class="sp-rank__pct">{{ (candidate.confidence * 100).toFixed(1) }}%</span>
      </li>
    </ol>

    <p v-else class="sp-empty">
      <span class="i-lucide-circle-alert" aria-hidden="true" />
      No candidate ranking — <code>suggest()</code> returned an empty array.
    </p>
  </DemoShell>
</template>

<style scoped>
.sp-rank {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-rank li {
  display: grid;
  grid-template-columns: 20px 20px minmax(0, auto) minmax(0, 1fr) 80px 48px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 13px;
}

.sp-rank li:first-child {
  border-color: var(--vp-c-brand-1);
}

.sp-rank__pos {
  font-size: 11px;
  color: var(--vp-c-text-3);
  text-align: center;
}

.sp-rank__formatted {
  font-size: 13px;
  white-space: nowrap;
}

.sp-rank__kind {
  color: var(--vp-c-text-2);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sp-rank__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}

.sp-rank__bar span {
  display: block;
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.15s ease;
}

.sp-rank__pct {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--vp-c-text-2);
  font-size: 12px;
}

@media (max-width: 640px) {
  .sp-rank li {
    grid-template-columns: 20px 20px minmax(0, 1fr) 56px;
  }
  .sp-rank__kind,
  .sp-rank__bar {
    display: none;
  }
}

.sp-empty {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
