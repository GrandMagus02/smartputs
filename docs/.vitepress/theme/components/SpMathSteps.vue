<script setup lang="ts">
import type { Step } from "../math";
import { shortRule } from "../math";
import SpTex from "./SpTex.vue";

withDefaults(
  defineProps<{
    steps: readonly Step[];
    /** Shown when the operation took no step worth reporting. */
    empty?: string;
  }>(),
  { empty: "No step — the expression was already in its final form." },
);
</script>

<template>
  <div class="sp-steps">
    <p v-if="steps.length === 0" class="sp-steps__empty">{{ empty }}</p>

    <ol v-else class="sp-steps__list">
      <li v-for="(step, index) in steps" :key="index" class="sp-steps__item">
        <span class="sp-steps__rule" :title="step.rule">{{ shortRule(step.rule) }}</span>
        <span class="sp-steps__title">{{ step.title }}</span>
        <span class="sp-steps__math">
          <SpTex :tex="step.before" />
          <span class="sp-steps__arrow i-lucide-arrow-right" aria-hidden="true" />
          <SpTex :tex="step.after" />
        </span>
        <span v-if="step.detail" class="sp-steps__detail">
          <SpTex :tex="step.detail" />
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.sp-steps__empty {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.sp-steps__list {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: sp-step;
  display: grid;
  gap: 8px;
}

.sp-steps__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  column-gap: 10px;
  row-gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.sp-steps__rule {
  grid-row: 1;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
}

.sp-steps__title {
  grid-row: 1;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.sp-steps__math {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.sp-steps__arrow {
  color: var(--vp-c-text-3);
}

.sp-steps__detail {
  grid-column: 1 / -1;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
</style>
