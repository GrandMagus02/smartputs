<script setup lang="ts">
import { Label } from "reka-ui";

/**
 * The field chrome — label, hint, error region — with nothing about units in
 * it. Reka UI's `Label` is the only primitive it needs: it renders a real
 * `<label>`, forwards `for`, and swallows the double-click text selection that
 * makes a label feel like a broken button.
 *
 * The control is a slot rather than an `<input>` prop, because the next
 * component up wraps a whole combobox in the same chrome.
 */
defineProps<{
  label: string;
  /** `useField().ids` — the field owns them so the wiring can be asserted. */
  ids: { input: string; error: string; hint: string };
  /** `useField().message` — `null` means "say nothing", not "say nothing yet". */
  message?: string | null;
  hint?: string;
  optional?: boolean;
}>();
</script>

<template>
  <div class="sp-formfield" :class="{ 'sp-formfield--invalid': message }">
    <Label :for="ids.input" class="sp-formfield__label">
      {{ label }}
      <span v-if="optional" class="sp-formfield__optional">optional</span>
    </Label>

    <slot />

    <!-- `role="alert"` and not `aria-live="assertive"`: the region is created
         and destroyed with the message, and only `role="alert"` is reliably
         announced when the node itself appears. -->
    <p v-if="message" :id="ids.error" class="sp-formfield__error" role="alert">
      <span class="i-hugeicons-alert-circle" aria-hidden="true" />
      {{ message }}
    </p>

    <p v-if="hint || $slots.hint" :id="ids.hint" class="sp-formfield__hint">
      <slot name="hint">{{ hint }}</slot>
    </p>
  </div>
</template>

<style scoped>
.sp-formfield {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-formfield__label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: fit-content;
  cursor: pointer;
}

.sp-formfield--invalid .sp-formfield__label {
  color: var(--vp-c-danger-1);
}

.sp-formfield__optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--vp-c-text-3);
}

.sp-formfield__error,
.sp-formfield__hint {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
}

.sp-formfield__error {
  color: var(--vp-c-danger-1);
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.sp-formfield__error > .i-hugeicons-alert-circle {
  flex: none;
  margin-top: 2px;
}

.sp-formfield__hint {
  color: var(--vp-c-text-3);
}

/* The control the slot renders. Styling it from here keeps every field on the
   site the same shape without each demo repeating the rules. */
.sp-formfield :deep(.sp-control) {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.5;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.sp-formfield :deep(.sp-control:focus) {
  outline: none;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.sp-formfield :deep(.sp-control[aria-invalid="true"]) {
  border-color: var(--vp-c-danger-1);
}

.sp-formfield :deep(.sp-control[aria-invalid="true"]:focus) {
  box-shadow: 0 0 0 3px var(--vp-c-danger-soft);
}
</style>
