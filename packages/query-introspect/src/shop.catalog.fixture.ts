import type { Catalog } from "./catalog";

/**
 * A Postgres catalogue, recorded from a real database rather than written out.
 *
 * The database is `scripts/shop.sql`, and `postgres.test.ts` reads it back and
 * asserts it still produces exactly this — so the reader is tested against
 * Postgres whenever there is one, and the emitter is tested against real
 * catalogue rows whether or not there is. Hand-writing this file instead would
 * have made every emitter test a test of what somebody imagined
 * `pg_get_constraintdef` returns.
 *
 * It covers, deliberately: a composite primary key (`order_lines`), a table
 * with no primary key at all (`events`), two foreign keys from one table to the
 * same other one (`orders` → `addresses`), an enum type and a
 * `CHECK (col IN (...))` as two routes to one `values` list, a `timestamptz`, a
 * `date`, a `numeric`, a domain over `text`, a `jsonb` this package has no
 * binding for, and `@smartput` annotations on one table and two columns.
 *
 * Regenerate with `scripts/record-fixture.ts`; never by hand.
 */
export const shopCatalog: Catalog = {
  dialect: "postgres",
  tables: [
    {
      name: "addresses",
      primaryKey: ["id"],
      columns: [
        {
          name: "id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "customer_id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "line1",
          sqlType: "text",
          type: "string",
        },
        {
          name: "lat",
          sqlType: "double precision",
          type: "number",
        },
        {
          name: "lon",
          sqlType: "double precision",
          type: "number",
        },
      ],
    },
    {
      name: "customers",
      primaryKey: ["id"],
      columns: [
        {
          name: "id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "name",
          sqlType: "text",
          type: "string",
        },
        {
          name: "email",
          sqlType: "email_address",
          type: "string",
        },
        {
          name: "country_code",
          sqlType: "character(2)",
          type: "string",
          comment: "@smartput kind=place aliases=country",
        },
        {
          name: "created_at",
          sqlType: "timestamp with time zone",
          type: "datetime",
        },
        {
          name: "tier",
          sqlType: "text",
          type: "string",
          values: ["free", "gold", "platinum"],
        },
        {
          name: "lifetime_cents",
          sqlType: "bigint",
          type: "number",
        },
      ],
    },
    {
      name: "events",
      primaryKey: [],
      columns: [
        {
          name: "at",
          sqlType: "timestamp with time zone",
          type: "datetime",
        },
        {
          name: "what",
          sqlType: "text",
          type: "string",
        },
      ],
    },
    {
      name: "order_lines",
      primaryKey: ["order_id", "line_no"],
      columns: [
        {
          name: "order_id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "line_no",
          sqlType: "integer",
          type: "number",
        },
        {
          name: "sku",
          sqlType: "text",
          type: "string",
        },
        {
          name: "qty",
          sqlType: "integer",
          type: "number",
        },
      ],
    },
    {
      name: "orders",
      primaryKey: ["id"],
      columns: [
        {
          name: "id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "customer_id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "billing_address_id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "shipping_address_id",
          sqlType: "bigint",
          type: "number",
        },
        {
          name: "status",
          sqlType: "order_status",
          type: "string",
          values: ["pending", "paid", "shipped", "cancelled"],
        },
        {
          name: "total_cents",
          sqlType: "bigint",
          type: "number",
          comment:
            "Order total, minor units.\n@smartput kind=money unit=usd scale=100 aliases=total, amount",
        },
        {
          name: "weight_g",
          sqlType: "numeric(12,3)",
          type: "number",
        },
        {
          name: "discount_rate",
          sqlType: "numeric(5,4)",
          type: "number",
        },
        {
          name: "placed_at",
          sqlType: "timestamp with time zone",
          type: "datetime",
        },
        {
          name: "delivered_on",
          sqlType: "date",
          type: "date",
        },
        {
          name: "is_gift",
          sqlType: "boolean",
          type: "boolean",
        },
        {
          name: "note",
          sqlType: "text",
          type: "string",
        },
        {
          name: "metadata",
          sqlType: "jsonb",
          type: "unknown",
        },
      ],
      comment: "One customer order.\n@smartput aliases=order, purchase, sale, sales",
    },
  ],
  foreignKeys: [
    {
      name: "addresses_customer_id_fkey",
      from: {
        table: "addresses",
        columns: ["customer_id"],
      },
      to: {
        table: "customers",
        columns: ["id"],
      },
    },
    {
      name: "order_lines_order_id_fkey",
      from: {
        table: "order_lines",
        columns: ["order_id"],
      },
      to: {
        table: "orders",
        columns: ["id"],
      },
    },
    {
      name: "orders_billing_address_id_fkey",
      from: {
        table: "orders",
        columns: ["billing_address_id"],
      },
      to: {
        table: "addresses",
        columns: ["id"],
      },
    },
    {
      name: "orders_customer_id_fkey",
      from: {
        table: "orders",
        columns: ["customer_id"],
      },
      to: {
        table: "customers",
        columns: ["id"],
      },
    },
    {
      name: "orders_shipping_address_id_fkey",
      from: {
        table: "orders",
        columns: ["shipping_address_id"],
      },
      to: {
        table: "addresses",
        columns: ["id"],
      },
    },
  ],
};
