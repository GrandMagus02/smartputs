<script setup lang="ts">
import { defineSchema, QueryEngine } from "@smartput/query";
import { MongoCompiler } from "@smartput/query/mongo";
import { SqlCompiler } from "@smartput/query/sql";
import { computed, ref } from "vue";
import { queryEngine } from "../engine";
import DemoShell from "./DemoShell.vue";

/**
 * Two tables, which is the smallest schema that can show the interesting part:
 * a money column stored in minor units, a column with a kind and one without,
 * and a join with exactly one path so a filter on customers can reach orders.
 *
 * `kind` is the field that matters. It says which engine kind reads the value
 * on the right of a predicate, so `over 500 usd` is money arithmetic and
 * `status is paid` is a plain enum — one schema, two entirely different reads.
 */
const shop = defineSchema({
  tables: [
    {
      name: "customers",
      aliases: ["customer", "client", "clients"],
      key: "id",
      labels: ["name"],
      columns: [
        { name: "id" },
        { name: "name" },
        { name: "country_code", aliases: ["country"], kind: "place" },
        { name: "tier", aliases: ["plan"], values: ["free", "gold", "platinum"] },
      ],
    },
    {
      name: "orders",
      aliases: ["order", "purchase", "purchases", "sale", "sales"],
      key: "id",
      columns: [
        { name: "id" },
        { name: "customer_id" },
        // Stored in cents: `scale` is how many stored units one `usd` is worth,
        // so the compiler emits 50000 for `500 usd` and never a float.
        {
          name: "total_cents",
          aliases: ["total", "amount", "price", "revenue"],
          kind: "money",
          unit: "usd",
          scale: 100,
        },
        { name: "weight_g", aliases: ["weight"], kind: "mass", unit: "g" },
        { name: "status", values: ["pending", "paid", "shipped", "cancelled"] },
      ],
    },
  ],
  // Joins are declared once for the schema, not per table: the grammar needs a
  // single path between any two tables, and a per-table list is where two
  // paths sneak in.
  joins: [{ from: "orders.customer_id", to: "customers.id" }],
  metrics: [
    { name: "revenue", aliases: ["spend"], fn: "sum", column: "orders.total_cents" },
  ],
});

const query = new QueryEngine({ schema: shop, engine: queryEngine });
const sql = new SqlCompiler();
const mongo = new MongoCompiler();

const input = ref("orders over 500 usd");

const examples = [
  "orders over 500 usd",
  "orders heavier than 2 kg",
  "orders where status is paid",
  "customers from ukraine",
  "top 10 orders by total",
  "orders between 100 and 500 usd",
];

type Outcome =
  | { status: "ok"; sql: unknown; mongo: unknown }
  | { status: "error"; name: string; message: string };

const outcome = computed<Outcome>(() => {
  if (input.value.trim() === "") {
    return { status: "error", name: "Empty", message: "Type a filter." };
  }
  try {
    // Parsed once and emitted twice, which is the point of an IR: the two
    // dialects disagree about syntax and agree about meaning.
    const ir = query.parse(input.value);
    return {
      status: "ok",
      sql: query.emit(ir, sql, input.value),
      mongo: query.emit(ir, mongo, input.value),
    };
  } catch (error) {
    return {
      status: "error",
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
});

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);
</script>

<template>
  <DemoShell title="QueryEngine.parse() → SQL and Mongo" icon="i-lucide-database">
    <label class="sp-field">
      <span class="sp-field__label">Filter</span>
      <input
        v-model="input"
        type="text"
        class="sp-input"
        spellcheck="false"
        autocomplete="off"
        placeholder="e.g. orders over 500 usd"
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

    <div v-if="outcome.status === 'error'" class="sp-query__error">
      <span class="i-lucide-circle-alert" aria-hidden="true" />
      <span><strong>{{ outcome.name }}</strong> — {{ outcome.message }}</span>
    </div>

    <div v-else class="sp-query">
      <section>
        <h5>SQL</h5>
        <pre><code>{{ pretty(outcome.sql) }}</code></pre>
      </section>
      <section>
        <h5>MongoDB</h5>
        <pre><code>{{ pretty(outcome.mongo) }}</code></pre>
      </section>
    </div>
  </DemoShell>
</template>

<style scoped>
.sp-query {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.sp-query h5 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
}

.sp-query pre {
  margin: 0;
  padding: 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow-x: auto;
}

.sp-query code {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

.sp-query__error {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--vp-c-danger-1);
}
</style>
