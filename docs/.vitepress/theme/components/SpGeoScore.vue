<script setup lang="ts">
import { haversine, normalizeName, similarity } from "@smartput/geo";
import { computed, ref } from "vue";
import DemoShell from "./DemoShell.vue";

/**
 * The half of geocoding that needs no network.
 *
 * `Geo` fronts providers, a cache and a rate limiter; what decides which of
 * their answers wins is this — a name similarity that folds diacritics and
 * transliterations, and a distance. Both are pure functions over data, so they
 * run here with no key and no request.
 */
const CANDIDATES = [
  { name: "München", country: "DE", lat: 48.1374, lon: 11.5755 },
  { name: "Munich", country: "US", lat: 40.9601, lon: -80.0187 },
  { name: "Kyiv", country: "UA", lat: 50.4547, lon: 30.5238 },
  { name: "Kiev", country: "UA", lat: 50.4547, lon: 30.5238 },
  { name: "Kief", country: "PL", lat: 52.1, lon: 21.0 },
  { name: "Köln", country: "DE", lat: 50.9333, lon: 6.95 },
  { name: "Cologne", country: "DE", lat: 50.9333, lon: 6.95 },
];

const input = ref("muenchen");
const near = ref("berlin");

const NEAR: Record<string, { lat: number; lon: number }> = {
  berlin: { lat: 52.52, lon: 13.405 },
  warsaw: { lat: 52.2297, lon: 21.0122 },
  "new york": { lat: 40.7128, lon: -74.006 },
};

const examples = ["muenchen", "munchen", "kiev", "koeln", "cologne", "munich"];

const scored = computed(() => {
  const anchor = NEAR[near.value];
  return CANDIDATES.map((row) => ({
    ...row,
    // `similarity(typed, matched)` — the argument order matters: it is
    // asymmetric, because a typed prefix of a long name is a better signal
    // than a long query against a short name.
    score: similarity(input.value, row.name),
    // Kilometres already — the constant inside is an Earth radius in km.
    km:
      anchor === undefined
        ? null
        : haversine({ lat: row.lat, lon: row.lon }, { lat: anchor.lat, lon: anchor.lon }),
  })).sort((a, b) => b.score - a.score || (a.km ?? 0) - (b.km ?? 0));
});

const folded = computed(() => normalizeName(input.value));
</script>

<template>
  <DemoShell title="similarity() and haversine(), with no provider" icon="i-lucide-globe">
    <label class="sp-field">
      <span class="sp-field__label">Typed name</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. muenchen"
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

    <p class="sp-geo__fold">
      <span class="sp-geo__key">normalizeName</span>
      <code>{{ folded }}</code>
    </p>

    <div class="sp-chips">
      <button
        v-for="(coord, city) in NEAR"
        :key="city"
        type="button"
        class="sp-chip"
        :class="{ 'sp-chip--on': city === near }"
        @click="near = String(city)"
      >
        near {{ city }}
      </button>
    </div>

    <ol class="sp-geo__list">
      <li v-for="row in scored" :key="`${row.name}-${row.country}`">
        <span class="sp-geo__name">{{ row.name }}</span>
        <span class="sp-geo__cc">{{ row.country }}</span>
        <span class="sp-geo__bar" aria-hidden="true">
          <span :style="{ width: `${Math.max(row.score, 0) * 100}%` }" />
        </span>
        <span class="sp-geo__num">{{ row.score.toFixed(2) }}</span>
        <span class="sp-geo__num">{{ row.km === null ? "—" : `${Math.round(row.km)} km` }}</span>
      </li>
    </ol>
  </DemoShell>
</template>

<style scoped>
.sp-geo__fold {
  margin: 0 0 12px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12.5px;
}

.sp-geo__key {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.sp-geo__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-geo__list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr) 44px 72px;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-size: 13px;
}

.sp-geo__list li:first-child {
  border-color: var(--vp-c-brand-1);
}

.sp-geo__cc,
.sp-geo__num {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.sp-geo__num {
  text-align: right;
}

.sp-geo__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}

.sp-geo__bar span {
  display: block;
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.15s ease;
}

@media (max-width: 640px) {
  .sp-geo__list li {
    grid-template-columns: minmax(0, 1fr) 32px 44px;
  }
  .sp-geo__bar,
  .sp-geo__num:last-child {
    display: none;
  }
}
</style>
