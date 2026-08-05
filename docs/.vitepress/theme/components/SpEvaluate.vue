<script setup lang="ts">
import { computed, ref } from "vue";
import { docsEngine, type Engine, evaluateSafely, moneyEngine } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    icon?: string;
    hint?: string;
    modelValue?: string;
    examples?: string[];
    /** Register `money` and its rate snapshot alongside the built-in kinds. */
    withMoney?: boolean;
  }>(),
  {
    title: "engine.evaluate(input)",
    icon: "i-lucide-calculator",
    modelValue: "1 kg + 500 g",
    examples: () => [],
    withMoney: false,
  },
);

const engine: Engine = props.withMoney ? moneyEngine : docsEngine;
const input = ref(props.modelValue);
const outcome = computed(() => evaluateSafely(engine, input.value));
</script>

<template>
  <DemoShell :title="title" :icon="icon" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="e.g. 2 km in m"
      />
    </label>

    <div v-if="examples.length" class="sp-chips">
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
