<script setup lang="ts">
import { createEngine, type Engine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { computed, ref, shallowRef } from "vue";
import { definePlace, type EvalOutcome, evaluateSafely, placeEngine } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

const input = ref("kyiv");

const t0 = computed(() => evaluateSafely(placeEngine, input.value));

/**
 * The T1 engine is built on demand, and the `import()` is the whole point of
 * this demo: a static import would link 6,247 cities into every page of this
 * site, which is exactly what `definePlace()` taking its tables as arguments
 * exists to prevent. Clicking the button is the reader performing the decision
 * the API asks a consumer to make.
 */
const cityEngine = shallowRef<Engine | null>(null);
const loading = ref(false);
const failed = ref("");

async function loadCities(): Promise<void> {
  if (cityEngine.value !== null || loading.value) return;
  loading.value = true;
  failed.value = "";
  try {
    // Only the gazetteer is dynamic. `definePlace` is already in this page's
    // bundle — it is what `placeEngine` beside it was built with — so importing
    // it again here would split nothing and only blur which module is the 234 KB.
    const { ADMIN1, CITIES } = await import("@smartput/city");
    cityEngine.value = createEngine({
      locales: [en],
      kinds: [...BUILTIN_KINDS, definePlace({ cities: CITIES, admin1: ADMIN1 })],
    });
  } catch (error) {
    failed.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

const t1 = computed<EvalOutcome | null>(() =>
  cityEngine.value === null ? null : evaluateSafely(cityEngine.value, input.value),
);

const examples = [
  "kyiv",
  "new york",
  "houston texas",
  "springfield illinois",
  "sydney new south wales",
  "athens greece",
  "kyiv to warsaw",
];
</script>

<template>
  <DemoShell title="The city tier, loaded on demand" icon="i-lucide-building-2">
    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        placeholder="e.g. houston texas"
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

    <div class="sp-city">
      <section class="sp-city__side">
        <h5 class="sp-city__title">
          <code>definePlace()</code>
          <span class="sp-city__tag">T0 · countries only</span>
        </h5>
        <SpResult :outcome="t0" compact />
      </section>

      <section class="sp-city__side">
        <h5 class="sp-city__title">
          <code>definePlace({ cities, admin1 })</code>
          <span class="sp-city__tag">T1 · 6,247 cities</span>
        </h5>

        <button
          v-if="cityEngine === null"
          type="button"
          class="sp-city__load"
          :disabled="loading"
          @click="loadCities"
        >
          <span :class="loading ? 'i-lucide-loader' : 'i-lucide-download'" aria-hidden="true" />
          {{ loading ? "Loading the gazetteer…" : "Load the city tier" }}
        </button>
        <p v-if="failed" class="sp-city__failed">{{ failed }}</p>

        <SpResult v-if="t1" :outcome="t1" compact />
      </section>
    </div>

    <template #hint>
      Both panels are the same kind with the same id, built by the same factory —
      the only difference is which tables the caller handed it. Until the button
      is pressed, this page has not downloaded a single city: on a minified
      gzipped bundle the countries are +27 KB and the cities are +234 KB on top,
      nearly nine times as much. Tiering is only real when the dependency edge
      runs from the consumer inwards, which is why
      <code>@smartput/country</code> exports a factory instead of a ready-made
      city kind, and why its one edge on <code>@smartput/city</code> is an
      <code>import type</code> that compiles away.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-city {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.sp-city__side {
  min-width: 0;
}

.sp-city__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
}

.sp-city__title code {
  font-size: 11px;
}

.sp-city__tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-city__load {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.sp-city__load:hover:not(:disabled) {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.sp-city__load:disabled {
  opacity: 0.6;
}

.sp-city__failed {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vp-c-danger-1);
}

@media (max-width: 620px) {
  .sp-city {
    grid-template-columns: 1fr;
  }
}
</style>
