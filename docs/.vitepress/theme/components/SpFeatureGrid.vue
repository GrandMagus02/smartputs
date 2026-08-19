<script setup lang="ts">
/**
 * The home page's feature grid. Bigger and terser than the default VPFeature
 * cards, with a runnable-looking example pinned to the bottom of each one
 * instead of buried mid-sentence.
 */
withDefaults(
  defineProps<{
    items: {
      icon: string;
      title: string;
      summary: string;
      examples: string[];
    }[];
  }>(),
  {},
);
</script>

<template>
  <ul class="sp-feat" role="list">
    <li v-for="item in items" :key="item.title" class="sp-feat__cell">
      <article class="sp-feat__card">
        <span class="sp-feat__icon-wrap">
          <span class="sp-feat__icon" :class="item.icon" aria-hidden="true" />
        </span>
        <h3 class="sp-feat__title">{{ item.title }}</h3>
        <p class="sp-feat__summary">{{ item.summary }}</p>
        <div v-if="item.examples.length" class="sp-feat__examples">
          <code v-for="ex in item.examples" :key="ex" class="sp-feat__example">{{ ex }}</code>
        </div>
      </article>
    </li>
  </ul>
</template>

<style scoped>
.sp-feat {
  list-style: none;
  padding: 0;
  margin: 24px 0 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.sp-feat__cell {
  margin: 0;
  display: flex;
}

.sp-feat__card {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 24px 24px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.sp-feat__card:hover {
  border-color: var(--vp-c-brand-2);
  background: var(--vp-c-bg-elv);
  transform: translateY(-2px);
}

.dark .sp-feat__card:hover {
  box-shadow: 0 0 32px -16px var(--sp-magenta);
}

/* The wrapper is the tilted panel; the glyph inside counter-rotates so the
   icon itself still reads upright, like a sticker slapped on at an angle. */
.sp-feat__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--vp-c-brand-soft);
  transform: rotate(-6deg);
}

.sp-feat__cell:nth-child(even) .sp-feat__icon-wrap {
  background: var(--vp-c-tip-soft);
  transform: rotate(6deg);
}

.sp-feat__icon {
  width: 22px;
  height: 22px;
  color: var(--vp-c-brand-1);
  transform: rotate(6deg);
}

.sp-feat__cell:nth-child(even) .sp-feat__icon {
  color: var(--vp-c-tip-1);
  transform: rotate(-6deg);
}

.sp-feat__title {
  margin: 0 0 8px;
  border: none;
  padding: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--vp-c-text-1);
}

.sp-feat__summary {
  flex: 1;
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.sp-feat__examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sp-feat__example {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.6;
}

.sp-feat__card:hover .sp-feat__example {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-2);
}

@media (max-width: 420px) {
  .sp-feat {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sp-feat__card {
    transition: none;
  }
}
</style>
