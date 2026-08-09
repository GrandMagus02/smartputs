<script setup lang="ts">
import type { HolidayMatch } from "@smartput/holiday/types";
import { computed, ref, shallowRef } from "vue";
import DemoShell from "./DemoShell.vue";

type FindHoliday = typeof import("@smartput/holiday").findHoliday;

/**
 * The rule table is ~1.5 MB bundled, so it arrives on a click and not on a page
 * load. That is the same decision `@smartput/datetime` makes by putting
 * holidays behind a subpath — this demo just makes the reader perform it.
 */
const find = shallowRef<FindHoliday | null>(null);
const loading = ref(false);
const failed = ref("");

const input = ref("christmas");
const country = ref("US");

const COUNTRIES = ["US", "GB", "UA", "DE", "FR", "PL", "JP", "CA"];

async function load(): Promise<void> {
  if (find.value !== null || loading.value) return;
  loading.value = true;
  failed.value = "";
  try {
    const mod = await import("@smartput/holiday");
    find.value = mod.findHoliday;
  } catch (error) {
    failed.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

const matches = computed<HolidayMatch[]>(() => {
  const fn = find.value;
  if (fn === null || input.value.trim() === "") return [];
  // `now` is a live clock: the proximity penalty is why "christmas" typed in
  // January reaches this December's and not last December's.
  return fn({ name: input.value, now: Date.now() }, { country: country.value });
});

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
</script>

<template>
  <DemoShell title="findHoliday(query, place)" icon="i-lucide-party-popper">
    <div v-if="find === null" class="sp-holiday__gate">
      <p>
        The rule table is about <strong>236 KB gzipped</strong>. Nothing on this
        page has loaded it — click to fetch it now.
      </p>
      <button type="button" class="sp-chip" :disabled="loading" @click="load">
        <span :class="loading ? 'i-lucide-loader' : 'i-lucide-download'" aria-hidden="true" />
        {{ loading ? "Loading…" : "Load the holiday table" }}
      </button>
      <p v-if="failed" class="sp-holiday__failed">{{ failed }}</p>
    </div>

    <template v-else>
      <label class="sp-field">
        <span class="sp-field__label">Holiday</span>
        <input
          v-model="input"
          type="text"
          class="sp-input"
          spellcheck="false"
          autocomplete="off"
          placeholder="e.g. christmas"
        />
      </label>

      <div class="sp-chips">
        <button
          v-for="code in COUNTRIES"
          :key="code"
          type="button"
          class="sp-chip"
          :class="{ 'sp-chip--on': code === country }"
          @click="country = code"
        >
          {{ code }}
        </button>
      </div>

      <ol v-if="matches.length" class="sp-holiday__list">
        <li v-for="match in matches" :key="`${match.country}-${match.rule}-${match.start}`">
          <span class="sp-holiday__name">{{ match.name }}</span>
          <code>{{ day(match.start) }}</code>
          <span class="sp-holiday__type">{{ match.type }}</span>
          <span class="sp-holiday__score">{{ match.score.toFixed(2) }}</span>
        </li>
      </ol>

      <p v-else class="sp-empty">
        <span class="i-lucide-circle-alert" aria-hidden="true" />
        No match above the score floor — a guess is not a match.
      </p>
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-holiday__gate p {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.sp-holiday__failed {
  color: var(--vp-c-danger-1);
  font-size: 12.5px;
}

.sp-holiday__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-holiday__list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 88px 44px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 13px;
}

.sp-holiday__list li:first-child {
  border-color: var(--vp-c-brand-1);
}

.sp-holiday__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-holiday__type,
.sp-holiday__score {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.sp-holiday__score {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .sp-holiday__list li {
    grid-template-columns: minmax(0, 1fr) 92px 44px;
  }
  .sp-holiday__type {
    display: none;
  }
}

.sp-empty {
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
