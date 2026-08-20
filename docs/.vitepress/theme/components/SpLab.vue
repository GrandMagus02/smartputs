<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { type EvalOutcome, evaluateSafely } from "../engine";
import {
  ALL_LOCALE_IDS,
  ALL_MODULE_IDS,
  buildLabEngine,
  LAB_LOCALES,
  LAB_MODULES,
  withPrerequisites,
} from "../lab";
import { fileEvent, telemetryEnabled } from "../telemetry";
import SpResult from "./SpResult.vue";

/**
 * The lab: one input, one engine, and the composition of that engine exposed
 * as the thing you are allowed to change.
 *
 * Every other demo on this site pins its engine so that one entry point can be
 * shown in isolation. Here the pinning is the subject — which kinds are
 * registered and which languages are installed is exactly what decides whether
 * an input reads at all, and that relationship is invisible on a page where
 * both are fixed. Switching `mass` off and watching "5 кг" stop resolving
 * teaches the registry in a way no paragraph does.
 *
 * Everything is on at the start. A reader who opens this page wants to see the
 * engine at its most capable; the interesting act is taking things away.
 */

const selectedModules = ref<string[]>([...ALL_MODULE_IDS]);
const selectedLocales = ref<string[]>([...ALL_LOCALE_IDS]);
const format = ref("en");
const input = ref("1 kg + 500 g");

/** The prerequisite closure, so the sidebar can mark what it pulled back in. */
const effectiveModules = computed(
  () => new Set(withPrerequisites(selectedModules.value)),
);

const groups = ["Built-in", "Time", "Opt-in"] as const;
const modulesByGroup = computed(() =>
  groups.map((group) => ({
    group,
    modules: LAB_MODULES.filter((m) => m.group === group),
  })),
);

const engine = shallowRef<Awaited<ReturnType<typeof buildLabEngine>> | null>(null);
const building = ref(true);
const buildError = ref<string | null>(null);

/**
 * A monotonic token per rebuild.
 *
 * Every vocabulary is a dynamic import, so a rebuild is asynchronous and two
 * of them can be in flight at once — clicking three toggles quickly is the
 * ordinary way to produce that. Without the token the slowest build wins
 * regardless of which selection it belonged to, and the page settles on an
 * engine nobody asked for.
 */
let buildToken = 0;

async function rebuild(): Promise<void> {
  const token = ++buildToken;
  building.value = true;
  buildError.value = null;
  try {
    const next = await buildLabEngine({
      moduleIds: selectedModules.value,
      localeIds: selectedLocales.value,
      format: format.value,
    });
    if (token !== buildToken) return;
    engine.value = next;
  } catch (error) {
    if (token !== buildToken) return;
    engine.value = null;
    buildError.value = error instanceof Error ? error.message : String(error);
  } finally {
    if (token === buildToken) building.value = false;
  }
}

watch([selectedModules, selectedLocales, format], rebuild, {
  deep: true,
  immediate: true,
});

/**
 * The output language must be one of the installed ones — `createEngine`
 * throws otherwise, on boot. Rather than let the sidebar produce that state
 * and report it as an error, unselecting the format locale moves the format.
 */
watch(selectedLocales, (locales) => {
  if (locales.length > 0 && !locales.includes(format.value)) format.value = locales[0];
});

const outcome = computed<EvalOutcome>(() =>
  engine.value === null ? { status: "empty" } : evaluateSafely(engine.value, input.value),
);

/**
 * The ranked readings, for the case the strict call refused.
 *
 * `suggest()` never throws, so an `AmbiguityError` becomes a list rather than
 * a dead end — which is the library's whole posture about ambiguity, and the
 * one thing a playground should show rather than describe.
 */
const suggestions = computed(() => {
  if (engine.value === null || outcome.value.status !== "error") return [];
  try {
    return engine.value.suggest(input.value).slice(0, 6);
  } catch {
    return [];
  }
});

const kindCount = computed(() =>
  LAB_MODULES.filter((m) => effectiveModules.value.has(m.id)).reduce(
    (n, m) => n + (m.id === "color" ? 2 : m.kinds.length),
    0,
  ),
);

// ── Telemetry ──────────────────────────────────────────────────────────────

/**
 * Failures are filed after the typing stops, never during it.
 *
 * "1 kg +" is an error at every keystroke on the way to "1 kg + 500 g", and a
 * table of one person's prefixes cannot be ranked. The delay is what makes a
 * row mean "somebody typed this and stopped", which is the only kind of row
 * worth counting.
 */
const FILE_AFTER_MS = 1200;
let pending: ReturnType<typeof setTimeout> | undefined;

watch(outcome, (current) => {
  if (pending !== undefined) clearTimeout(pending);
  if (!telemetryEnabled || current.status !== "error") return;
  const snapshot = { text: input.value, name: current.name, message: current.message };
  pending = setTimeout(() => {
    void fileEvent({
      type: "error",
      input: snapshot.text,
      errorName: snapshot.name,
      errorMessage: snapshot.message,
      modules: [...effectiveModules.value],
      locales: [...selectedLocales.value],
    });
  }, FILE_AFTER_MS);
});

onBeforeUnmount(() => {
  if (pending !== undefined) clearTimeout(pending);
});

// ── Report ─────────────────────────────────────────────────────────────────

const reportOpen = ref(false);
const reportText = ref("");
const reportState = ref<"idle" | "sending" | "sent" | "failed">("idle");

function openReport(): void {
  reportState.value = "idle";
  reportOpen.value = true;
}

async function sendReport(): Promise<void> {
  if (reportText.value.trim() === "") return;
  reportState.value = "sending";
  const ok = await fileEvent({
    type: "report",
    input: input.value,
    errorName: outcome.value.status === "error" ? outcome.value.name : null,
    errorMessage: outcome.value.status === "error" ? outcome.value.message : null,
    message: reportText.value,
    modules: [...effectiveModules.value],
    locales: [...selectedLocales.value],
  });
  reportState.value = ok ? "sent" : "failed";
  if (ok) {
    reportText.value = "";
    setTimeout(() => {
      reportOpen.value = false;
    }, 1400);
  }
}

// ── Sidebar helpers ────────────────────────────────────────────────────────

function toggle(list: typeof selectedModules, id: string): void {
  const at = list.value.indexOf(id);
  if (at === -1) list.value = [...list.value, id];
  else list.value = list.value.filter((x) => x !== id);
}

const EXAMPLES = [
  "1 kg + 500 g",
  "zwei Kilometer plus 500 Meter",
  "5 кілограмів + 500 грамів",
  "212 F in C",
  "100 km / 2 h",
  "30 usd in gbp",
  "20% of 150",
  "2 GB + 500 MB",
  "10 m",
];
</script>

<template>
  <div class="lab">
    <aside class="lab__side">
      <section class="lab__group">
        <header class="lab__grouphead">
          <h3>Modules</h3>
          <div class="lab__bulk">
            <button type="button" @click="selectedModules = [...ALL_MODULE_IDS]">All</button>
            <button type="button" @click="selectedModules = []">None</button>
          </div>
        </header>

        <div v-for="g in modulesByGroup" :key="g.group" class="lab__sub">
          <h4>{{ g.group }}</h4>
          <label
            v-for="m in g.modules"
            :key="m.id"
            class="lab__row"
            :class="{
              'lab__row--implied':
                !selectedModules.includes(m.id) && effectiveModules.has(m.id),
            }"
            :title="m.note"
          >
            <input
              type="checkbox"
              :checked="selectedModules.includes(m.id)"
              @change="toggle(selectedModules, m.id)"
            />
            <span class="lab__rowlabel">{{ m.label }}</span>
            <span
              v-if="!selectedModules.includes(m.id) && effectiveModules.has(m.id)"
              class="lab__tag"
              title="Switched on because another module requires it"
              >needed</span
            >
          </label>
        </div>
      </section>

      <section class="lab__group">
        <header class="lab__grouphead">
          <h3>Locales</h3>
          <div class="lab__bulk">
            <button type="button" @click="selectedLocales = [...ALL_LOCALE_IDS]">All</button>
            <button type="button" @click="selectedLocales = ['en']">Only en</button>
          </div>
        </header>

        <label v-for="l in LAB_LOCALES" :key="l.id" class="lab__row">
          <input
            type="checkbox"
            :checked="selectedLocales.includes(l.id)"
            @change="toggle(selectedLocales, l.id)"
          />
          <span class="lab__rowlabel">{{ l.native }}</span>
          <code class="lab__code">{{ l.id }}</code>
        </label>

        <label class="lab__format">
          <span>Writes in</span>
          <select v-model="format">
            <option v-for="id in selectedLocales" :key="id" :value="id">
              {{ LAB_LOCALES.find((l) => l.id === id)?.native ?? id }}
            </option>
          </select>
        </label>
        <p class="lab__note">
          Recognition reads every locale installed. Generation writes in one.
        </p>
      </section>

      <section class="lab__group">
        <button type="button" class="lab__report" @click="openReport">
          <span class="i-hugeicons-bug-01" aria-hidden="true" />
          Report what you typed
        </button>
        <p v-if="!telemetryEnabled" class="lab__note">
          Reporting is off — this build has no telemetry credentials.
        </p>
      </section>
    </aside>

    <main class="lab__main">
      <div class="lab__inputwrap">
        <input
          v-model="input"
          type="text"
          class="lab__input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          placeholder="Type anything — 1 kg + 500 g, 212 F in C, 5 кілограмів"
        />
      </div>

      <div class="lab__chips">
        <button
          v-for="ex in EXAMPLES"
          :key="ex"
          type="button"
          class="lab__chip"
          @click="input = ex"
        >
          {{ ex }}
        </button>
      </div>

      <p v-if="building" class="lab__status">Building the engine…</p>
      <p v-else-if="buildError" class="lab__status lab__status--bad">
        The engine refused this composition: {{ buildError }}
      </p>
      <template v-else>
        <SpResult :outcome="outcome" />

        <section v-if="suggestions.length" class="lab__suggest">
          <h4>suggest() ranked these anyway</h4>
          <ul>
            <li v-for="(s, i) in suggestions" :key="i">
              <code>{{ s.kind }}</code>
              <span>{{ s.formatted }}</span>
              <em>{{ Math.round(s.confidence * 100) }}%</em>
            </li>
          </ul>
        </section>
      </template>

      <footer class="lab__meta">
        <span>{{ kindCount }} kinds</span>
        <span>{{ selectedLocales.length }} locales</span>
        <span>writes {{ format }}</span>
      </footer>

      <p v-if="telemetryEnabled" class="lab__privacy">
        Inputs this engine refuses are recorded, along with the modules and locales
        switched on, so the missing phrasings can be ranked and fixed. No account, no
        cookie, no identifier that survives a reload. Do not paste anything private.
      </p>
    </main>

    <div v-if="reportOpen" class="lab__scrim" @click.self="reportOpen = false">
      <div class="lab__modal" role="dialog" aria-modal="true" aria-label="Report">
        <h3>What went wrong?</h3>
        <p class="lab__note">
          Plain words are fine — "this should have been kilometres", "no idea why this
          failed". Say what you expected; that is the part the input cannot tell us.
        </p>

        <dl class="lab__snapshot">
          <dt>Input</dt>
          <dd><code>{{ input || "(empty)" }}</code></dd>
          <dt>Result</dt>
          <dd>
            <code v-if="outcome.status === 'error'">{{ outcome.name }}</code>
            <span v-else-if="outcome.status === 'ok'">{{ outcome.result.formatted }}</span>
            <span v-else>nothing typed</span>
          </dd>
          <dt>Engine</dt>
          <dd>{{ kindCount }} kinds, {{ selectedLocales.length }} locales, writes {{ format }}</dd>
        </dl>

        <textarea
          v-model="reportText"
          rows="4"
          placeholder="I expected…"
          :disabled="reportState === 'sending'"
        />

        <div class="lab__modalfoot">
          <span v-if="reportState === 'sent'" class="lab__ok">Sent — thank you.</span>
          <span v-else-if="reportState === 'failed'" class="lab__bad">
            Could not send. Nothing was lost from the page.
          </span>
          <span v-else class="lab__note">The snapshot above is sent with it.</span>
          <button type="button" class="lab__ghost" @click="reportOpen = false">Close</button>
          <button
            type="button"
            class="lab__send"
            :disabled="reportText.trim() === '' || reportState === 'sending'"
            @click="sendReport"
          >
            {{ reportState === "sending" ? "Sending…" : "Send" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

@media (max-width: 860px) {
  .lab {
    grid-template-columns: minmax(0, 1fr);
  }
}

.lab__side {
  position: sticky;
  top: 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: calc(100vh - 128px);
  overflow-y: auto;
  padding-right: 4px;
}

@media (max-width: 860px) {
  .lab__side {
    position: static;
    max-height: none;
  }
}

.lab__group {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 12px 14px;
}

.lab__grouphead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.lab__grouphead h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-2);
}

.lab__bulk {
  display: flex;
  gap: 6px;
}

.lab__bulk button {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

.lab__bulk button:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.lab__sub h4 {
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

.lab__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
  cursor: pointer;
  line-height: 1.5;
}

.lab__rowlabel {
  flex: 1;
  min-width: 0;
}

/* A module nothing selected but something needs. Dimmed rather than checked:
   the box still reports what the reader chose, and the tag says why it is on. */
.lab__row--implied .lab__rowlabel {
  color: var(--vp-c-text-3);
}

.lab__tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.lab__code {
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.lab__format {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.lab__format select {
  flex: 1;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.lab__note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--vp-c-text-3);
}

.lab__report {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
}

.lab__report:hover {
  background: var(--vp-c-brand-2);
}

.lab__inputwrap {
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  padding: 6px;
}

.lab__input {
  width: 100%;
  padding: 16px 18px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 22px;
  line-height: 1.4;
  font-family: var(--vp-font-family-mono);
}

.lab__input:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.lab__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 18px;
}

.lab__chip {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
}

.lab__chip:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.lab__status {
  padding: 16px;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 14px;
}

.lab__status--bad {
  color: var(--vp-c-danger-1);
}

.lab__suggest {
  margin-top: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--vp-c-bg-soft);
}

.lab__suggest h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}

.lab__suggest ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lab__suggest li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
  border-top: 1px solid var(--vp-c-divider);
}

.lab__suggest li:first-child {
  border-top: 0;
}

.lab__suggest li span {
  flex: 1;
}

.lab__suggest li em {
  font-style: normal;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.lab__meta {
  display: flex;
  gap: 14px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.lab__privacy {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 11px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

.lab__scrim {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(0 0 0 / 55%);
}

.lab__modal {
  width: min(520px, 100%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  padding: 20px;
}

.lab__modal h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.lab__snapshot {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 4px 12px;
  margin: 14px 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 12px;
}

.lab__snapshot dt {
  color: var(--vp-c-text-3);
}

.lab__snapshot dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.lab__modal textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.lab__modalfoot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.lab__modalfoot > :first-child {
  flex: 1;
  margin: 0;
}

.lab__ok {
  font-size: 12px;
  color: var(--vp-c-brand-1);
}

.lab__bad {
  font-size: 12px;
  color: var(--vp-c-danger-1);
}

.lab__ghost,
.lab__send {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.lab__ghost {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
}

.lab__send {
  color: var(--vp-c-bg);
  background: var(--vp-c-brand-1);
}

.lab__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
