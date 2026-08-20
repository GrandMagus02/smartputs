/**
 * Re-records the two fixtures this package's tests run against.
 *
 * A fixture that re-records itself proves nothing, which is why this is a
 * script somebody runs deliberately rather than something a test does: the
 * committed files are the expected output, and a diff in either is a change to
 * read rather than to accept. `scripts/shop.sql` is the database it reads.
 *
 *   createdb shop
 *   psql -d shop -f packages/query-introspect/scripts/shop.sql
 *   DATABASE_URL=postgres://…/shop bun run packages/query-introspect/scripts/record-fixture.ts
 */
import { SchemaEmitter } from "../src/emit";
import { PostgresIntrospector } from "../src/postgres";
import { CATALOG_HEADER, FIXTURE_SOURCE } from "../src/shop.header.fixture";

const url = process.env.DATABASE_URL;
if (url === undefined) {
  console.error("Set $DATABASE_URL to the shop.sql database.");
  process.exit(2);
}

const here = new URL("../src/", import.meta.url);
const catalog = await new PostgresIntrospector({ url }).read();

await Bun.write(
  new URL("shop.catalog.fixture.ts", here),
  `${CATALOG_HEADER}${JSON.stringify(catalog, null, 2)};\n`,
);

const emitter = new SchemaEmitter(catalog, { source: FIXTURE_SOURCE });
await Bun.write(new URL("shop.schema.fixture.ts", here), emitter.emit());
for (const note of emitter.notes) console.error(`note: ${note}`);

// Biome, not a hand-rolled printer: the catalogue fixture is `JSON.stringify`
// output and the schema fixture has to survive `bun run lint` unedited, which
// is itself one of the claims this package makes.
const format = Bun.spawn(["bunx", "biome", "check", "--write", Bun.fileURLToPath(here)], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await format.exited);
