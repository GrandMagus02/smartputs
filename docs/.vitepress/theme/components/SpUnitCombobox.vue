<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  useFilter,
} from "reka-ui";
import { computed, ref } from "vue";
import { useField } from "../useField";
import { fieldKind } from "../validation";
import DemoShell from "./DemoShell.vue";
import SpField from "./SpField.vue";

const props = withDefaults(
  defineProps<{
    kind?: string;
    modelValue?: string;
    limit?: number;
    hint?: string;
  }>(),
  { kind: "length", modelValue: "", limit: 8, hint: undefined },
);

const kind = computed(() => fieldKind(props.kind));
const value = ref(props.modelValue);
const field = useField({ kind, value, when: "blur", required: true });

/**
 * Everything after the last digit or space is what the person is still typing.
 * Completing the *whole* input would fight the number in front of it; this
 * splits once and rewrites only the tail, which is also what makes accepting a
 * row idempotent.
 */
const TAIL = /[\p{L}%°/µ]*$/u;

const fragment = computed(() => value.value.match(TAIL)?.[0] ?? "");
const head = computed(() =>
  value.value.slice(0, value.value.length - fragment.value.length),
);

/** Alias → unit, deduped and shortest-first, so `cm` outranks `centimetres`. */
const aliases = computed(() =>
  Object.entries(kind.value.table.alias)
    .map(([alias, unit]) => ({ alias, unit }))
    .sort((a, b) => a.alias.length - b.alias.length || a.alias.localeCompare(b.alias)),
);

// `sensitivity: "base"` folds case, accents and compatibility forms in one
// pass, so `CM` reaches `cm` and `m2` reaches `m²` without a hand-rolled fold.
const { startsWith } = useFilter({ sensitivity: "base" });

const rows = computed(() => {
  if (fragment.value === "") return [];
  return aliases.value
    .filter(
      (row) => startsWith(row.alias, fragment.value) && row.alias !== fragment.value,
    )
    .slice(0, props.limit);
});

function accept(alias: unknown): void {
  if (typeof alias !== "string") return;
  value.value = `${head.value}${alias}`;
}
</script>

<template>
  <DemoShell
    title="Reka UI Combobox over one unit table"
    icon="i-lucide-text-cursor-input"
    :hint="hint"
    overflow
  >
    <!-- `ignore-filter` because the filtering is ours: the rows come from the
         kind's alias table matched against the tail of the input, not from the
         rendered text of a static list. -->
    <ComboboxRoot
      ignore-filter
      open-on-focus
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      class="sp-cb"
      @update:model-value="accept"
    >
      <SpField
        :label="kind.label"
        :ids="field.ids"
        :message="field.message.value"
      >
        <ComboboxAnchor class="sp-cb__anchor">
          <ComboboxInput
            v-bind="field.inputProps.value"
            v-model="value"
            class="sp-control"
            spellcheck="false"
            :placeholder="kind.example"
          />
        </ComboboxAnchor>

        <ComboboxContent class="sp-cb__list">
          <ComboboxItem
            v-for="row in rows"
            :key="row.alias"
            :value="row.alias"
            class="sp-cb__item"
          >
            <span class="sp-cb__alias">
              <b>{{ row.alias.slice(0, fragment.length) }}</b>{{ row.alias.slice(fragment.length) }}
            </span>
            <span class="sp-cb__unit">{{ row.unit }}</span>
          </ComboboxItem>

          <ComboboxEmpty class="sp-cb__empty">
            No unit of {{ kind.label.toLowerCase() }} starts with
            <code>{{ fragment }}</code>.
          </ComboboxEmpty>
        </ComboboxContent>

        <template #hint>
          ↓ ↑ to move, Enter to accept, Esc to close. The list is the kind's own
          alias table — no engine, no network.
        </template>
      </SpField>
    </ComboboxRoot>
  </DemoShell>
</template>

<style scoped>
.sp-cb {
  position: relative;
}

.sp-cb__anchor {
  display: block;
}

.sp-cb__list {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  margin-top: 4px;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-3);
}

.sp-cb__item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 8px;
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  cursor: pointer;
}

/* Reka UI sets `data-highlighted` on the row the keyboard is on — the styling
   hook that replaces tracking an active index by hand. */
.sp-cb__item[data-highlighted] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  outline: none;
}

.sp-cb__alias b {
  color: var(--vp-c-brand-1);
}

.sp-cb__unit {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.sp-cb__empty {
  padding: 8px;
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.sp-cb__empty code {
  font-size: 12px;
}
</style>
