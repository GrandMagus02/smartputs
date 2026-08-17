<script setup lang="ts">
import { computed, ref } from "vue";
import { useField } from "../useField";
import { FIELD_KINDS, fieldKind, unitKeys } from "../validation";
import DemoShell from "./DemoShell.vue";
import SpField from "./SpField.vue";

const props = withDefaults(
  defineProps<{
    kind?: string;
    modelValue?: string;
    when?: "input" | "blur";
    required?: boolean;
    /** Let the reader switch kinds; off when a page is making a point about one. */
    switchable?: boolean;
    hint?: string;
  }>(),
  {
    kind: "length",
    modelValue: "",
    when: "blur",
    required: true,
    switchable: true,
    hint: undefined,
  },
);

const kindId = ref(props.kind);
const kind = computed(() => fieldKind(kindId.value));
const value = ref(props.modelValue);

const field = useField({ kind, value, when: props.when, required: props.required });

const units = computed(() => unitKeys(kind.value.table).join(" · "));

/** The `ErrCode` on the last parse, so the template needs no narrowing cast. */
const code = computed(() => {
  const parsed = field.parsed.value;
  return parsed.ok ? null : parsed.code;
});
</script>

<template>
  <DemoShell title="parseX() behind one <input>" icon="i-hugeicons-checkmark-square-01" :hint="hint">
    <div v-if="switchable" class="sp-chips">
      <button
        v-for="entry in FIELD_KINDS"
        :key="entry.id"
        type="button"
        class="sp-chip"
        :class="{ 'sp-chip--on': entry.id === kindId }"
        @click="kindId = entry.id"
      >
        {{ entry.label }}
      </button>
    </div>

    <SpField
      :label="kind.label"
      :ids="field.ids"
      :message="field.message.value"
      :optional="!required"
    >
      <input
        v-bind="field.inputProps.value"
        v-model="value"
        type="text"
        class="sp-control"
        inputmode="decimal"
        spellcheck="false"
        autocomplete="off"
        :placeholder="kind.example"
      />

      <template #hint>Accepts {{ units }} and their spelled-out names.</template>
    </SpField>

    <dl class="sp-parse">
      <div>
        <dt>parse</dt>
        <dd>
          <code>{{ JSON.stringify(field.parsed.value) }}</code>
        </dd>
      </div>
      <div>
        <dt>state</dt>
        <dd>
          <span class="sp-pill" :class="field.valid.value ? 'sp-pill--ok' : 'sp-pill--bad'">
            {{ field.valid.value ? "valid" : `invalid — ${code}` }}
          </span>
          <span v-if="!field.touched.value" class="sp-pill sp-pill--mute">untouched</span>
        </dd>
      </div>
    </dl>
  </DemoShell>
</template>

<style scoped>
.sp-parse {
  margin: 14px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
}

.sp-parse > div {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
}

.sp-parse dt {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.sp-parse dd {
  margin: 0;
  min-width: 0;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.sp-parse code {
  font-size: 11.5px;
  word-break: break-all;
}

.sp-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}

.sp-pill--ok {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.sp-pill--bad {
  color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.sp-pill--mute {
  color: var(--vp-c-text-3);
}
</style>
