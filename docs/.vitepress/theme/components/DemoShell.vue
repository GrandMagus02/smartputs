<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    icon?: string;
    hint?: string;
    /**
     * Let a child paint outside the card. Off by default — the rounded corners
     * depend on it — and on for the one demo that opens a dropdown, which an
     * `overflow: hidden` ancestor cuts off at the card's edge no matter how the
     * list itself is positioned.
     */
    overflow?: boolean;
  }>(),
  { icon: undefined, hint: undefined, overflow: false },
);
</script>

<template>
  <section class="sp-demo" :class="{ 'sp-demo--overflow': overflow }">
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

/* With the clip gone the header and footer have to round their own corners —
   that is what `overflow: hidden` was doing for them. */
.sp-demo--overflow {
  overflow: visible;
}

.sp-demo--overflow .sp-demo__head {
  border-radius: 12px 12px 0 0;
}

.sp-demo--overflow .sp-demo__hint {
  border-radius: 0 0 12px 12px;
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
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

/* The hint is prose with inline `code` in it, so it must stay a normal text
   flow — a flex container would make every inline child its own column. */
.sp-demo__hint > .i-lucide-message-square-quote {
  margin-right: 6px;
}

.sp-demo__hint code {
  font-size: 12px;
}
</style>
