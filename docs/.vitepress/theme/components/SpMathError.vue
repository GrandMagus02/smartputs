<script setup lang="ts">
defineProps<{ name: string; message: string }>();
</script>

<template>
  <p class="sp-math-error">
    <span class="i-lucide-triangle-alert" aria-hidden="true" />
    <code>{{ name }}</code>
    <span>{{ message }}</span>
  </p>
</template>

<style scoped>
.sp-math-error {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-danger-1);
  border-radius: 8px;
  background: var(--vp-c-danger-soft);
  font-size: 13px;
  line-height: 1.6;
}

.sp-math-error code {
  font-size: 12px;
}
</style>
