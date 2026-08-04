<script setup lang="ts">
defineProps<{
  title: string
  icon?: string
  hint?: string
}>()
</script>

<template>
  <section class="sp-demo">
    <header class="sp-demo__head">
      <span class="sp-demo__icon" :class="icon ?? 'i-lucide-play'" aria-hidden="true" />
      <h4 class="sp-demo__title">{{ title }}</h4>
      <span class="sp-demo__badge">live</span>
    </header>

    <div class="sp-demo__body">
      <slot />
    </div>

    <p v-if="hint || $slots.hint" class="sp-demo__hint">
      <span class="i-lucide-message-square-quote" aria-hidden="true" />
      <slot name="hint">{{ hint }}</slot>
    </p>
  </section>
</template>

<style scoped>
.sp-demo {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.sp-demo__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.sp-demo__icon {
  color: var(--vp-c-brand-1);
}

.sp-demo__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.4;
  flex: 1;
}

.sp-demo__badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.sp-demo__body {
  padding: 16px;
}

.sp-demo__hint {
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  display: flex;
  gap: 8px;
  align-items: baseline;
}
</style>
