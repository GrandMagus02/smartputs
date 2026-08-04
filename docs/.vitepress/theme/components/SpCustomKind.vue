<script setup lang="ts">
import type { Kind } from "@smartput/core";
import { defineKind } from "@smartput/core";
import { computed, ref } from "vue";
import { createDocsEngine, evaluateSafely } from "../engine";
import DemoShell from "./DemoShell.vue";
import SpResult from "./SpResult.vue";

const id = ref("datasize");
const canonical = ref("b");
const unitsText = ref(
  ["b = 1", "kb = 1e3", "kib = 1024", "mb = 1e6", "mib = 1024 ** 2"].join("\n"),
);
const expression = ref("2 mib + 500 kb in kb");

/** `1024 ** 2` without an evaluator: two numbers and one operator, nothing else. */
function parseRatio(raw: string): number | null {
  const power = raw.match(/^\s*(-?[\d.]+(?:e[+-]?\d+)?)\s*\*\*\s*(-?[\d.]+)\s*$/i);
  if (power) return Number(power[1]) ** Number(power[2]);
  const plain = Number(raw.trim());
  return Number.isFinite(plain) ? plain : null;
}

type Parsed =
  | { status: "ok"; kind: Kind; units: Record<string, number> }
  | { status: "error"; message: string };

const parsed = computed<Parsed>(() => {
  const units: Record<string, number> = {};
  for (const line of unitsText.value.split("\n")) {
    if (line.trim() === "") continue;
    const [name, ...rest] = line.split("=");
    const key = name?.trim() ?? "";
    if (key === "" || rest.length === 0) {
      return { status: "error", message: `Cannot read unit line: ${line.trim()}` };
    }
    const ratio = parseRatio(rest.join("="));
    if (ratio === null) {
      return { status: "error", message: `Not a number: ${rest.join("=").trim()}` };
    }
    units[key] = ratio;
  }

  if (Object.keys(units).length === 0) {
    return { status: "error", message: "Define at least one unit." };
  }
  if (!(canonical.value in units)) {
    return {
      status: "error",
      message: `Canonical unit "${canonical.value}" is not in the unit table.`,
    };
  }

  try {
    const kind = defineKind({
      id: id.value.trim(),
      value: { mode: "ratio", canonical: canonical.value.trim(), units },
    });
    return { status: "ok", kind, units };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

const outcome = computed(() => {
  if (parsed.value.status === "error") {
    return { status: "error" as const, name: "KindError", message: parsed.value.message };
  }
  try {
    const engine = createDocsEngine({ kinds: [parsed.value.kind] });
    return evaluateSafely(engine, expression.value);
  } catch (error) {
    return {
      status: "error" as const,
      name: "createEngine",
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

const source = computed(() => {
  if (parsed.value.status === "error") return "// fix the unit table above";
  const entries = Object.entries(parsed.value.units)
    .map(([unit, ratio]) => `${unit}: ${ratio}`)
    .join(", ");
  return [
    "const kind = defineKind({",
    `  id: ${JSON.stringify(id.value.trim())},`,
    `  value: { mode: "ratio", canonical: ${JSON.stringify(canonical.value.trim())},`,
    `           units: { ${entries} } },`,
    "})",
  ].join("\n");
});
</script>

<template>
  <DemoShell title="defineKind() — a new kind, live" icon="i-lucide-puzzle">
    <div class="sp-kind">
      <label class="sp-field">
        <span class="sp-field__label">Kind id</span>
        <input v-model="id" type="text" class="sp-input" spellcheck="false" />
      </label>
      <label class="sp-field">
        <span class="sp-field__label">Canonical unit</span>
        <input v-model="canonical" type="text" class="sp-input" spellcheck="false" />
      </label>
    </div>

    <label class="sp-field">
      <span class="sp-field__label">Units — one <code>name = ratio</code> per line</span>
      <textarea v-model="unitsText" rows="5" class="sp-input sp-input--area" spellcheck="false" />
    </label>

    <pre class="sp-code">{{ source }}</pre>

    <label class="sp-field">
      <span class="sp-field__label">Expression</span>
      <input v-model="expression" type="text" class="sp-input" spellcheck="false" />
    </label>

    <SpResult :outcome="outcome" />

    <template #hint>
      No lexicon, no ops, no format function — aliases fall back to the unit
      keys and <code>+ - * / in</code> are generated for any ratio kind. That is
      the whole registration surface.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-kind {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

@media (max-width: 520px) {
  .sp-kind {
    grid-template-columns: 1fr;
  }
}

.sp-code {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
}
</style>
