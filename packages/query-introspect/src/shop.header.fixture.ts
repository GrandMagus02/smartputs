/**
 * The two constants the fixture recorder and the tests both need.
 *
 * They live here because `shop.catalog.fixture.ts` is generated — its doc
 * comment is written into it by `scripts/record-fixture.ts` — and because
 * `emit.test.ts` has to build the emitter with exactly the options the recorder
 * built it with or the committed file would never match.
 */

/** The `source` label the committed schema fixture was emitted with. */
export const FIXTURE_SOURCE = "shop, schema public";

/** Everything above the recorded catalogue literal, verbatim. */
export const CATALOG_HEADER = `import type { Catalog } from "./catalog";

/**
 * A Postgres catalogue, recorded from a real database rather than written out.
 *
 * The database is \`scripts/shop.sql\`, and \`postgres.test.ts\` reads it back and
 * asserts it still produces exactly this — so the reader is tested against
 * Postgres whenever there is one, and the emitter is tested against real
 * catalogue rows whether or not there is. Hand-writing this file instead would
 * have made every emitter test a test of what somebody imagined
 * \`pg_get_constraintdef\` returns.
 *
 * It covers, deliberately: a composite primary key (\`order_lines\`), a table
 * with no primary key at all (\`events\`), two foreign keys from one table to the
 * same other one (\`orders\` → \`addresses\`), an enum type and a
 * \`CHECK (col IN (...))\` as two routes to one \`values\` list, a \`timestamptz\`, a
 * \`date\`, a \`numeric\`, a domain over \`text\`, a \`jsonb\` this package has no
 * binding for, and \`@smartput\` annotations on one table and two columns.
 *
 * Regenerate with \`scripts/record-fixture.ts\`; never by hand.
 */
export const shopCatalog: Catalog = `;
