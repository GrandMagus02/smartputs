<script setup lang="ts">
import { computed } from "vue";
import { round4, round4Text } from "../display";
import { type EvalOutcome, kindIcon } from "../engine";

const props = defineProps<{
  outcome: EvalOutcome;
  /** Hide the canonical/unit/confidence grid for compact demos. */
  compact?: boolean;
}>();

const confidencePercent = computed(() =>
  props.outcome.status === "ok"
    ? `${Math.round(props.outcome.result.confidence * 100)}%`
    : "",
);

// Display trims, not engine output: the Result carries full precision either
// way, and both of these are the same value at four decimal places.
const formatted = computed(() =>
  props.outcome.status === "ok" ? round4Text(props.outcome.result.formatted) : "",
);

const canonical = computed(() =>
  props.outcome.status === "ok" ? round4(props.outcome.result.value.canonical) : "",
);

// `@smartput/color`'s canonical is the packed `0xRRGGBBAA` sRGB pixel
// `packSrgb` produces — the one kind here whose number is worth painting
// rather than printing.
const swatch = computed(() => {
  if (props.outcome.status !== "ok" || props.outcome.result.kind !== "color") return null;
  const packed = props.outcome.result.value.canonical.toNumber();
  const r = (packed >>> 24) & 0xff;
  const g = (packed >>> 16) & 0xff;
  const b = (packed >>> 8) & 0xff;
  const a = packed & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
});
</script>

<template>
  <div v-if="outcome.status === 'empty'" class="sp-result sp-result--idle">
    <span class="i-hugeicons-computer-terminal-01" aria-hidden="true" />
    <span>Type an expression to evaluate it.</span>
  </div>

  <div v-else-if="outcome.status === 'error'" class="sp-result sp-result--error">
    <div class="sp-result__line">
      <span class="i-hugeicons-cancel-circle" aria-hidden="true" />
      <code class="sp-result__errname">{{ outcome.name }}</code>
    </div>
    <p class="sp-result__msg">{{ outcome.message }}</p>
  </div>

  <div v-else class="sp-result sp-result--ok">
    <div class="sp-result__line">
      <span
        v-if="swatch"
        class="sp-result__swatch"
        :style="{ backgroundColor: swatch }"
        aria-hidden="true"
      />
      <span v-else :class="kindIcon(outcome.result.kind)" aria-hidden="true" />
      <strong class="sp-result__formatted">{{ formatted }}</strong>
      <span class="sp-result__kind">{{ outcome.result.kind }}</span>
    </div>

    <dl v-if="!compact" class="sp-result__grid">
      <div>
        <dt>canonical</dt>
        <dd><code>{{ canonical }}</code></dd>
      </div>
      <div>
        <dt>unit</dt>
        <dd><code>{{ outcome.result.value.unit }}</code></dd>
      </div>
      <div>
        <dt>confidence</dt>
        <dd><code>{{ confidencePercent }}</code></dd>
      </div>
    </dl>

    <p v-if="outcome.result.meta.assumptions.length" class="sp-result__assumptions">
      <span class="i-hugeicons-alert-02" aria-hidden="true" />
      {{ outcome.result.meta.assumptions.map((a) => a.message).join('; ') }}
    </p>
  </div>
</template>

<style scoped>
.sp-result {
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.sp-result--idle {
  color: var(--vp-c-text-3);
  display: flex;
  gap: 8px;
  align-items: center;
}

.sp-result--error {
  border-color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.sp-result--ok {
  border-color: var(--vp-c-brand-1);
}

.sp-result__line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-result--error .sp-result__line {
  color: var(--vp-c-danger-1);
}

.sp-result--ok .sp-result__line {
  color: var(--vp-c-brand-1);
}

.sp-result__swatch {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.35);
  background-image:
    linear-gradient(45deg, rgba(128, 128, 128, 0.25) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(128, 128, 128, 0.25) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(128, 128, 128, 0.25) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(128, 128, 128, 0.25) 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
}

.sp-result__formatted {
  font-family: var(--vp-font-family-mono);
  font-size: 18px;
  color: var(--vp-c-text-1);
  word-break: break-all;
}

.sp-result__kind {
  margin-left: auto;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-2);
}

.sp-result__errname {
  font-size: 13px;
}

.sp-result__msg {
  margin: 6px 0 0;
  color: var(--vp-c-text-1);
  line-height: 1.6;
}

.sp-result__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 12px 0 0;
}

.sp-result__grid dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-result__grid dd {
  margin: 2px 0 0;
}

.sp-result__grid code {
  font-size: 12px;
  word-break: break-all;
}

.sp-result__assumptions {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
  display: flex;
  gap: 6px;
  align-items: baseline;
}
</style>
