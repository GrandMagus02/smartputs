<script setup lang="ts">
import { computed, ref } from "vue";
import { evaluateSafely, rangeEngine } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    modelValue?: string;
    examples?: string[];
    hint?: string;
  }>(),
  {
    title: "A value with two ends",
    modelValue: "whole week",
    examples: () => [
      "whole week",
      "10:00 - 20:00",
      "yesterday morning",
      "from today until friday",
      "last month",
      "3pm to 6pm",
    ],
    hint: undefined,
  },
);

const input = ref(props.modelValue);
const outcome = computed(() => evaluateSafely(rangeEngine, input.value));

/**
 * The clock is `Date.now()`, not the corpus's frozen 2026-01-15 — a demo that
 * says "yesterday" and means a date in January is a screenshot. The formatted
 * output therefore moves; the shape of it does not.
 */
</script>

<template>
  <DemoShell :title="title" icon="i-lucide-calendar-range" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. whole week"
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

    <SpResult :outcome="outcome" />
  </DemoShell>
</template>
