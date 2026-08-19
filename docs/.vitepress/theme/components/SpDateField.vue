<script setup lang="ts">
import { computed, ref } from "vue";
import { evaluateSafely, rangeEngine } from "../engine";
import DemoShell from "./DemoShell.vue";

/**
 * The date field from /guide/examples/date-field: one text input, no popup, and
 * a confirmation line that says what the sentence was read as before anything
 * is submitted.
 */
const input = ref("next friday");

const outcome = computed(() => evaluateSafely(rangeEngine, input.value));

interface Reading {
  /** The instant a single-valued reading landed on. */
  readonly start: string;
  /** The far end, when the phrase named a span rather than a moment. */
  readonly end?: string;
  readonly kind: string;
}

/**
 * Every date kind in the repo puts its answer on `meta` — `iso` for a moment,
 * `start`/`end` for a span — because `canonical` is a scalar and a calendar day
 * is not one. Reading both here is what lets one field accept "tomorrow" and
 * "last week" without asking which it is going to get.
 */
const reading = computed<Reading | null>(() => {
  if (outcome.value.status !== "ok") return null;
  const meta = (outcome.value.result.value.meta ?? {}) as {
    iso?: string;
    start?: string;
    end?: string;
  };
  const start = meta.iso ?? meta.start;
  if (start === undefined) return null;
  return { start, end: meta.end, kind: outcome.value.result.kind };
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * `meta.iso` is a Temporal string, and a Temporal string ends in a bracketed
 * zone — `2026-08-28T00:00:00+00:00[UTC]`. `Date` does not accept that suffix
 * and throws `RangeError: Invalid time value` on it, which is why the offset in
 * front of the bracket is the part that has to be kept and the bracket dropped.
 */
const instant = (iso: string): Date => new Date(iso.replace(/\[[^\]]*\]$/, ""));

const day = (iso: string): string => dayFormat.format(instant(iso));

/** Midnight is "no time was said", and printing 00:00 would claim one was. */
const clock = (iso: string): string => {
  const at = instant(iso);
  return at.getUTCHours() === 0 && at.getUTCMinutes() === 0 ? "" : timeFormat.format(at);
};

const relative = computed(() => {
  if (reading.value === null) return "";
  const days = Math.round(
    (instant(reading.value.start).getTime() - Date.now()) / 86_400_000,
  );
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return rtf.format(days, "day");
});

/** What the form would actually submit — the value, not the sentence. */
const submitted = computed(() =>
  reading.value === null ? "" : reading.value.start.slice(0, 10),
);

const examples = [
  "tomorrow",
  "next friday",
  "in 3 days",
  "next monday 9am",
  "march 3",
  "3 days ago",
  "last week",
  "18 aug 2026",
  // A field like this is where the ordinal grammars earn their keep: nobody
  // wants to open a calendar to find the first Friday of next month.
  "first friday next month",
  "second monday in Aug 2027",
  "second week Aug 2027",
];
</script>

<template>
  <DemoShell title="A date field with no calendar in it" icon="i-hugeicons-date-time">
    <label class="sp-field">
      <span class="sp-field__label">Due date</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="e.g. next friday"
      />
    </label>

    <div class="sp-chips">
      <button
        v-for="example in examples"
        :key="example"
        type="button"
        class="sp-chip"
        @click="input = example"
      >
        {{ example }}
      </button>
    </div>

    <!-- Client-only: the clock is live, so the server's "next friday" and the
         browser's would be different days and hydration would say so. -->
    <ClientOnly>
      <p v-if="reading && !reading.end" class="sp-date__read">
        <span class="i-hugeicons-checkmark-circle-02" aria-hidden="true" />
        <strong>{{ day(reading.start) }}</strong>
        <span v-if="clock(reading.start)" class="sp-date__clock">{{ clock(reading.start) }}</span>
        <span class="sp-date__rel">{{ relative }}</span>
      </p>

      <p v-else-if="reading" class="sp-date__read sp-date__read--span">
        <span class="i-hugeicons-alert-02" aria-hidden="true" />
        <span>
          That is a span — <strong>{{ day(reading.start) }}</strong> to
          <strong>{{ day(reading.end as string) }}</strong>. A single-date field
          takes the start; a filter takes both.
        </span>
      </p>

      <p v-else-if="outcome.status === 'error'" class="sp-date__read sp-date__read--bad">
        <span class="i-hugeicons-cancel-circle" aria-hidden="true" />
        <span>Not a date yet — keep typing, or pick one above.</span>
      </p>

      <p v-else class="sp-date__read sp-date__read--idle">Nothing read yet.</p>

      <pre v-if="submitted" class="sp-code">form.dueDate = {{ JSON.stringify(submitted) }}   // {{ reading?.kind }}</pre>
    </ClientOnly>

    <template #hint>
      The engine behind this field registers <code>datetime</code>,
      <code>date</code>, <code>time</code> and the three range kinds, so one
      input answers "tomorrow", "next monday 9am" and "last week" without the
      form knowing in advance which shape it is going to get. The line under the
      input is not decoration: a field that guesses silently is a field that
      books the wrong flight.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-date__read {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.sp-date__read strong {
  font-family: var(--vp-font-family-mono);
}

.sp-date__read--span {
  border-color: var(--vp-c-warning-3);
  background: var(--vp-c-warning-soft);
  font-size: 13px;
  line-height: 1.6;
}

.sp-date__read--bad {
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.sp-date__read--idle {
  border-color: var(--vp-c-divider);
  color: var(--vp-c-text-3);
  font-size: 13px;
}

.sp-date__clock {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-brand-1);
}

.sp-date__rel {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.sp-code {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  overflow-x: auto;
}
</style>
