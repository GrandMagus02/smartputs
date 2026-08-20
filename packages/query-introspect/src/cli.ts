#!/usr/bin/env bun
import { parseArgs } from "node:util";
import type { Catalog } from "./catalog";
import { DriftCheck, loadSchemaFile } from "./drift";
import { SchemaEmitter } from "./emit";
import { UsageError } from "./errors";
import { PostgresIntrospector } from "./postgres";

const HELP = `smartput-query-introspect — a @smartput/query schema out of a live database

  bunx @smartput/query-introspect --url postgres://… --out schema.ts

The file it writes is a starting point you own: it holds what the catalogue
proves and a TODO for everything a catalogue cannot know. Commit it, edit it,
and run --check in CI so a migration cannot leave it behind.

  --url <url>        Postgres connection URL. Defaults to $DATABASE_URL.
  --out <path>       Where to write. Without it the file goes to stdout.
  --check            Read <path> back and compare it against the database.
                     Exits 1 on drift, and writes nothing, ever.
  --force            Overwrite an existing <path>.
  --schema <name>    Database schema to read. Default "public".
  --name <ident>     Name of the exported binding. Default "schema".
  --exclude <table>  Leave a table out. Repeatable, and honoured by --check.
  --help

Anything you would otherwise re-edit after every regeneration belongs in the
database, where it survives one:

  COMMENT ON COLUMN orders.total_cents IS
    '@smartput kind=money unit=usd scale=100 aliases=total, amount';
`;

/**
 * The connection target without its credentials, for the generated header.
 *
 * A generated file is committed, and a URL with a password in it is committed
 * with it. The database and schema names are the useful half and are not a
 * secret, so that is the half that goes in.
 */
function label(url: string, schema: string): string | undefined {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "");
    return database.length === 0 ? undefined : `${database}, schema ${schema}`;
  } catch {
    return undefined;
  }
}

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value.trim().length === 0 ? undefined : value;

async function main(): Promise<number> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      url: { type: "string" },
      out: { type: "string" },
      schema: { type: "string" },
      name: { type: "string" },
      exclude: { type: "string", multiple: true },
      check: { type: "boolean" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help === true) {
    process.stdout.write(HELP);
    return 0;
  }

  // An empty `$DATABASE_URL` counts as unset. `Bun.SQL("")` does not fail: it
  // falls through to libpq's defaults and connects to whatever local socket
  // exists, which is the one outcome a database tool must never reach by
  // accident.
  const url = values.url ?? nonEmpty(process.env.DATABASE_URL);
  if (url === undefined) {
    throw new UsageError("No database to read. Pass --url, or set $DATABASE_URL.");
  }
  // Every refusal that does not need the database happens before the
  // connection, so `--out` at a file you meant to keep costs a message rather
  // than a round trip to a production replica.
  if (values.check === true && values.out === undefined) {
    throw new UsageError("--check needs --out <path>: the file it reads back.");
  }
  if (
    values.check !== true &&
    values.force !== true &&
    values.out !== undefined &&
    (await Bun.file(values.out).exists())
  ) {
    // The default refuses, because the file is the author's. Everything worth
    // having in it — a unit, an alias, a metric — is a hand edit, and a tool
    // that overwrote them on a rerun is a tool people run once.
    throw new UsageError(
      `${values.out} already exists. Pass --check to see what the database has that it does not, or --force to overwrite it.`,
    );
  }

  const schema = values.schema ?? "public";
  const exclude = values.exclude ?? [];
  const catalog: Catalog = await new PostgresIntrospector({ url, schema }).read();

  return values.check === true
    ? await check(catalog, values.out as string, exclude)
    : await write(catalog, values, schema, url, exclude);
}

/**
 * `--check`. Reads the committed file back and reports what the database has
 * that it does not.
 *
 * It never writes, not even with `--force`: the mode exists to be run in CI on
 * a checkout nobody is watching, and a check that could rewrite the thing it is
 * checking is a check whose failure disappears into a diff.
 */
async function check(
  catalog: Catalog,
  out: string,
  exclude: readonly string[],
): Promise<number> {
  const committed = await loadSchemaFile(out);
  const drift = new DriftCheck(catalog, committed, { exclude });
  const found = drift.run();
  for (const note of drift.notes) console.error(`note: ${note}`);
  if (found.length === 0) {
    console.error(`${out} matches the database.`);
    return 0;
  }
  console.error(`${out} has drifted from the database:`);
  // Padded so the kinds line up: the list is read by scanning the left column
  // for the one word that matters, and a ragged one is read by nobody.
  for (const one of found) {
    console.error(`  ${one.kind.padEnd(14)} ${one.where}: ${one.detail}`);
  }
  console.error(
    "\nRegenerate with --force and re-apply your edits, or fix the file by hand.",
  );
  return 1;
}

async function write(
  catalog: Catalog,
  values: { out?: string; name?: string; force?: boolean },
  schema: string,
  url: string,
  exclude: readonly string[],
): Promise<number> {
  const source = label(url, schema);
  const emitter = new SchemaEmitter(catalog, {
    ...(values.name === undefined ? {} : { name: values.name }),
    ...(source === undefined ? {} : { source }),
    exclude,
  });
  const text = emitter.emit();

  if (values.out === undefined) {
    process.stdout.write(text);
  } else {
    await Bun.write(values.out, text);
    console.error(`Wrote ${values.out}.`);
  }
  for (const note of emitter.notes) console.error(`note: ${note}`);
  return 0;
}

try {
  process.exit(await main());
} catch (e) {
  if (e instanceof UsageError) {
    console.error(e.message);
    process.exit(2);
  }
  console.error(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  process.exit(2);
}
