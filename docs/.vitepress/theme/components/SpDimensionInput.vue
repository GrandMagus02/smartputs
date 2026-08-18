<script setup lang="ts">
import { computed, ref } from "vue";
import { CSS_UNITS, type CssUnit, createCssEngine, pxPerUnit } from "../css-kind";
import { evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";

/**
 * The dimension field from /guide/examples/dimension-input, whole: an
 * expression in px / rem / em / %, a document those three resolve against, and
 * the px the layout actually gets.
 */
const rootFontSize = ref(16);
const parentSize = ref(320);

const engine = computed(() =>
  createCssEngine({
    rootFontSize: rootFontSize.value,
    fontSize: rootFontSize.value,
    parentSize: parentSize.value,
  }),
);

/** What a bare number means. Figma's rule: the unit the field is already in. */
const unit = ref<CssUnit>("px");
const text = ref("2+4px");

/**
 * A bare `2+4` is a number, and a number is not a width. Rather than teach the
 * kind a default unit — the kind has no idea which field it is in — the field
 * re-reads the number it got in its own unit. Two evaluations, and the second
 * one is over a string the first one produced, so nothing here parses by hand.
 */
const outcome = computed(() => {
  const first = evaluateSafely(engine.value, text.value);
  if (first.status !== "ok" || first.result.kind !== "number") return first;
  return evaluateSafely(
    engine.value,
    `${first.result.value.canonical.toString()}${unit.value}`,
  );
});

const px = computed(() => {
  if (outcome.value.status !== "ok") return null;
  const value = outcome.value.result.value;
  return value.canonical.toNumber();
});

/** The width the preview bar gets, clamped to the parent it is drawn inside. */
const barWidth = computed(() =>
  px.value === null ? 0 : Math.max(0, Math.min(px.value, parentSize.value)),
);

const overflows = computed(() => px.value !== null && px.value > parentSize.value);

/** Committing is Figma's: the expression is replaced by what it came to. */
function commit(): void {
  if (outcome.value.status !== "ok") return;
  text.value = outcome.value.result.formatted;
  unit.value = outcome.value.result.value.unit as CssUnit;
}

const examples = ["2+4px", "100% - 24px", "1.5rem", "24px in rem", "50%", "16px + 1rem"];

const rem = computed(() => pxPerUnit("rem", { rootFontSize: rootFontSize.value }));
</script>

<template>
  <DemoShell title="A dimension field with arithmetic in it" icon="i-hugeicons-ruler">
    <div class="sp-dim">
      <!-- The inspector row: a unit-bearing expression, committed on Enter or
           blur exactly the way a design tool commits one. -->
      <label class="sp-dim__row">
        <span class="sp-dim__key">W</span>
        <input
          v-model="text"
          type="text"
          class="sp-input sp-dim__input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          inputmode="text"
          aria-label="Width"
          @keyup.enter="commit"
          @blur="commit"
        />
        <!-- The field's unit, which is what a bare number becomes — not
             necessarily the unit the current expression came out in. -->
        <span class="sp-dim__unit" :title="`a bare number here means ${unit}`">{{ unit }}</span>
      </label>

      <p v-if="outcome.status === 'ok'" class="sp-dim__out">
        <span class="i-hugeicons-arrow-right-02" aria-hidden="true" />
        <strong>{{ outcome.result.formatted }}</strong>
        <span class="sp-dim__px">{{ px }} px in the layout</span>
      </p>
      <p v-else-if="outcome.status === 'error'" class="sp-dim__out sp-dim__out--bad">
        <span class="i-hugeicons-cancel-circle" aria-hidden="true" />
        <span>{{ outcome.message }}</span>
      </p>
      <p v-else class="sp-dim__out sp-dim__out--idle">Type a width.</p>

      <div class="sp-chips">
        <button
          v-for="example in examples"
          :key="example"
          type="button"
          class="sp-chip"
          @click="text = example"
        >
          {{ example }}
        </button>
      </div>

      <!-- The document. `rem` and `%` are ratios that read it, so moving either
           slider moves every value written in those units and none written in
           px — which is the whole reason they are units and not sugar. -->
      <div class="sp-dim__doc">
        <label class="sp-field">
          <span class="sp-field__label">Root font size — <code>1rem = {{ rem }}px</code></span>
          <input v-model.number="rootFontSize" type="range" min="10" max="32" step="1" />
        </label>
        <label class="sp-field">
          <span class="sp-field__label">Parent width — <code>100% = {{ parentSize }}px</code></span>
          <input v-model.number="parentSize" type="range" min="120" max="640" step="8" />
        </label>
      </div>

      <div class="sp-dim__preview" :style="{ width: `${parentSize}px` }">
        <div class="sp-dim__bar" :class="{ 'sp-dim__bar--over': overflows }" :style="{ width: `${barWidth}px` }" />
      </div>
    </div>

    <template #hint>
      One engine, two kinds: <code>number</code> for the arithmetic and a
      <code>css</code> kind whose <code>rem</code>, <code>em</code> and
      <code>%</code> ratios are functions of the document above. A bare number
      beside a dimension takes that dimension's unit — that is two op
      signatures, not a special case in the parser — and a lone number takes the
      field's, which is the field's business and is done in the component.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-dim__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
}

.sp-dim__key {
  flex: none;
  width: 22px;
  text-align: center;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.sp-dim__input {
  border: none;
  background: transparent;
  padding: 3px 0;
}

.sp-dim__input:focus {
  box-shadow: none;
}

.sp-dim__unit {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
}

.sp-dim__out {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 10px 0 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-brand-1);
}

.sp-dim__out--bad {
  color: var(--vp-c-danger-1);
  font-family: inherit;
  font-size: 13px;
}

.sp-dim__out--idle {
  color: var(--vp-c-text-3);
  font-family: inherit;
  font-size: 13px;
}

.sp-dim__px {
  margin-left: auto;
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.sp-dim__doc {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 4px;
}

.sp-dim__doc input[type="range"] {
  width: 100%;
  accent-color: var(--vp-c-brand-2);
}

.sp-dim__preview {
  max-width: 100%;
  height: 26px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-alt);
  overflow: hidden;
}

.sp-dim__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--sp-magenta), var(--sp-cyan));
  transition: width 0.15s ease-out;
}

.sp-dim__bar--over {
  background: linear-gradient(90deg, var(--sp-amber), var(--sp-magenta));
}
</style>
