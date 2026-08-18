<script setup lang="ts">
import { as } from "@smartput/shared";
import { computed, ref } from "vue";
import { FIELD_KINDS, fieldKind, messageFor, unitKeys } from "../validation";
import DemoShell from "./DemoShell.vue";

/**
 * The bulk-import recipe from /guide/examples/pasted-column: one column of
 * whatever a spreadsheet had in it, parsed row by row through the micro path,
 * with the failures separated from the values rather than dropped.
 */
const kindId = ref("mass");
const field = computed(() => fieldKind(kindId.value));

const pasted = ref(
  ["500 g", "1,5 kg", "2 lbs", "16oz", "three", "0.4kg", "750"].join("\n"),
);

/** The unit every good row is converted into before it is stored. */
const target = computed(() => field.value.table.canonical);

interface Row {
  readonly raw: string;
  /** The number and unit as authored, once they parsed. */
  readonly authored: string | null;
  /** The same value in the storage unit. */
  readonly stored: number | null;
  readonly message: string | null;
}

/**
 * Whether a comma in this file is a decimal point.
 *
 * The micro parser reads `1.5 kg` and refuses `1,5 kg` — deliberately, because
 * telling `1,500` (a thousand and a half, or one and a half?) apart needs
 * `Intl` and the locale's number format, which is the engine's job and not
 * something a 1.5 KB parser should guess at. A file, though, has one
 * convention throughout, and the person who pasted it knows which. So it is a
 * switch here rather than a guess in there.
 */
const commaIsDecimal = ref(false);

const normalize = (line: string): string =>
  commaIsDecimal.value ? line.replace(/,/g, ".") : line;

const rows = computed<Row[]>(() =>
  pasted.value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((raw) => {
      const parsed = field.value.parse(normalize(raw));
      if (!parsed.ok) {
        return {
          raw,
          authored: null,
          stored: null,
          message: messageFor(field.value, parsed),
        };
      }
      // `as` is the same table's converter — no engine, no `Decimal`, and the
      // offsets an affine kind needs are its business rather than this loop's.
      const converted = as(field.value.table, parsed, target.value);
      return {
        raw,
        authored: `${parsed.value} ${parsed.unit}`,
        stored: converted.ok ? converted.value : null,
        message: converted.ok ? null : messageFor(field.value, converted),
      };
    }),
);

const good = computed(() => rows.value.filter((row) => row.message === null));
const bad = computed(() => rows.value.filter((row) => row.message !== null));

const units = computed(() => unitKeys(field.value.table).slice(0, 6).join(", "));

/** Four decimals is this site's display trim, not the parser's — see /playground. */
const show = (value: number): string => String(Math.round(value * 10_000) / 10_000);
</script>

<template>
  <DemoShell title="A pasted column, row by row" icon="i-hugeicons-checkmark-square-01">
    <div class="sp-col__head">
      <label class="sp-field">
        <span class="sp-field__label">Column holds</span>
        <select v-model="kindId" class="sp-input">
          <option v-for="entry in FIELD_KINDS" :key="entry.id" :value="entry.id">
            {{ entry.label }}
          </option>
        </select>
      </label>
      <p class="sp-col__units">
        Accepts <code>{{ units }}</code> — and stores <code>{{ target }}</code>.
      </p>
    </div>

    <label class="sp-field">
      <span class="sp-field__label">Pasted — one value per line</span>
      <textarea v-model="pasted" rows="7" class="sp-input sp-input--area" spellcheck="false" />
    </label>

    <p class="sp-col__tally">
      <strong>{{ good.length }}</strong> parsed ·
      <strong :class="{ 'sp-col__fail': bad.length > 0 }">{{ bad.length }}</strong> need a look
      <label class="sp-col__switch">
        <input v-model="commaIsDecimal" type="checkbox" />
        comma is a decimal point in this file
      </label>
    </p>

    <table class="sp-col__table">
      <thead>
        <tr>
          <th>Cell</th>
          <th>Read as</th>
          <th>Stored, in {{ target }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in rows"
          :key="`${index}-${row.raw}`"
          :class="{ 'sp-col__bad': row.message }"
        >
          <td><code>{{ row.raw }}</code></td>
          <td>
            <code v-if="row.message === null">{{ row.authored }}</code>
            <span v-else class="sp-col__msg">{{ row.message }}</span>
          </td>
          <td>
            <code v-if="row.stored !== null">{{ show(row.stored) }}</code>
            <span v-else>—</span>
          </td>
        </tr>
      </tbody>
    </table>

    <template #hint>
      No engine on this page: every row goes through the kind's own
      <code>parse</code>, which is about 1.5 KB and returns
      <code>Ok | Err</code> rather than throwing. A row that fails keeps its
      text and gets a sentence — an importer that silently drops the rows it
      could not read is an importer that loses data quietly.
    </template>
  </DemoShell>
</template>

<style scoped>
.sp-col__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 12px;
  align-items: center;
}

.sp-col__units {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}

.sp-col__tally {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.sp-col__switch {
  float: right;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.sp-col__switch input {
  accent-color: var(--vp-c-brand-2);
}

.sp-col__fail {
  color: var(--vp-c-danger-1);
}

.sp-col__table {
  display: table;
  width: 100%;
  margin: 0;
  font-size: 13px;
}

.sp-col__table th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.sp-col__table code {
  font-size: 12px;
}

.sp-col__bad {
  background: var(--vp-c-danger-soft);
}

.sp-col__msg {
  color: var(--vp-c-text-2);
}

@media (max-width: 560px) {
  .sp-col__head {
    grid-template-columns: 1fr;
  }
}
</style>
