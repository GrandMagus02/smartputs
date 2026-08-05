<script setup lang="ts">
/**
 * Shown while `@smartput/math` is on its way down. It is a computer algebra
 * system fetched on demand, so the wait is real on a cold cache and a demo that
 * renders nothing in the meantime reads as broken.
 */
</script>

<template>
  <p class="sp-math-loading">
    <span class="i-lucide-loader-circle" aria-hidden="true" />
    <span>Loading the math engine…</span>
  </p>
</template>

<style scoped>
.sp-math-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.sp-math-loading > span:first-child {
  animation: sp-spin 1.1s linear infinite;
}

@keyframes sp-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
