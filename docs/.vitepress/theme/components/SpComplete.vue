<script setup lang="ts">
import { computed, ref } from "vue";
import { docsEngine, type Engine, evaluateSafely, moneyEngine } from "../engine";
import { useCompletions } from "../useCompletions";
import DemoShell from "./DemoShell.vue";
import SpCompletionList from "./SpCompletionList.vue";
import SpResult from "./SpResult.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    hint?: string;
    modelValue?: string;
    examples?: string[];
    /** Register the money kind too, so currencies compete for the fragment. */
    withMoney?: boolean;
  }>(),
  {
    title: "engine.complete(input)",
    modelValue: "30 ho",
    examples: () => [],
    withMoney: false,
  },
);

const engine: Engine = props.withMoney ? moneyEngine : docsEngine;

const input = ref(props.modelValue);
const completions = useCompletions({ engine, input, limit: 6 });

// The completion list ranks; the result below shows what the top row would
// evaluate to once accepted, which is the whole point of ranking them.
const preview = computed(() => {
  const top = completions.rows.value[0];
  return evaluateSafely(engine, top === undefined ? input.value : top.text);
});

function onKeydown(event: KeyboardEvent) {
  if (completions.onKeydown(event)) event.preventDefault();
}
</script>

<template>
  <DemoShell :title="title" icon="i-lucide-text-cursor-input" :hint="hint">
    <label class="sp-field">
      <span class="sp-field__label">Expression — ↓ ↑ to move, Enter to accept</span>
      <div class="sp-complete">
        <input
          v-model="input"
          type="text"
          class="sp-input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          role="combobox"
          :aria-expanded="completions.open.value"
          aria-controls="sp-complete-list"
          placeholder="e.g. 30 ho"
          @keydown="onKeydown"
        />
        <div v-if="completions.open.value" id="sp-complete-list" class="sp-complete__pop">
          <SpCompletionList
            :rows="completions.rows.value"
            :active="completions.active.value"
            :input="input"
            @pick="completions.accept"
          />
        </div>
      </div>
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

    <p v-if="!completions.rows.value.length" class="sp-complete__none">
      <template v-if="completions.suppressed.value">
        Already a finished unit — the only rows left would rewrite the input to
        itself.
      </template>
      <template v-else>
        No trailing fragment to complete — <code>complete()</code> returns an
        empty array rather than throwing.
      </template>
    </p>

    <SpResult :outcome="preview" compact />
  </DemoShell>
</template>

<style scoped>
.sp-complete {
  position: relative;
}

/* Absolute so the demo below does not jump as rows appear and disappear. */
.sp-complete__pop {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
}

.sp-complete__none {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
