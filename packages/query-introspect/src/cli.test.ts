import { expect, test } from "bun:test";
import { unlink } from "node:fs/promises";

/**
 * The command line, run as a command line.
 *
 * Four of these need no database, because every refusal that does not need one
 * happens before the connection — which is itself the claim: pointing `--out`
 * at a file you meant to keep costs a message, not a round trip to a replica.
 * The last two run only when `$SMARTPUT_INTROSPECT_URL` names a database built
 * from `scripts/shop.sql`.
 */
const CLI = `${import.meta.dir}/cli.ts`;

async function run(
  args: readonly string[],
): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(["bun", "run", CLI, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, DATABASE_URL: "" },
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, out, err };
}

test("--help explains the shape of the thing", async () => {
  const { code, out } = await run(["--help"]);
  expect(code).toBe(0);
  expect(out).toContain("--check");
  expect(out).toContain("COMMENT ON COLUMN");
});

test("no database is a usage error, not a stack trace", async () => {
  const { code, err } = await run([]);
  expect(code).toBe(2);
  expect(err).toContain("No database to read");
});

test("--check without --out has nothing to read back", async () => {
  const { code, err } = await run(["--url", "postgres://nowhere/db", "--check"]);
  expect(code).toBe(2);
  expect(err).toContain("--check needs --out");
});

test("an existing file is not overwritten, and the refusal is cheap", async () => {
  // `postgres://nowhere/db` would not connect. Reaching the refusal proves the
  // check happens first.
  const { code, err } = await run([
    "--url",
    "postgres://nowhere/db",
    "--out",
    `${import.meta.dir}/shop.schema.fixture.ts`,
  ]);
  expect(code).toBe(2);
  expect(err).toContain("already exists");
  expect(err).toContain("--force");
});

const url = process.env.SMARTPUT_INTROSPECT_URL;
const live = test.skipIf(url === undefined);

live("a generated file passes its own --check", async () => {
  const out = `${import.meta.dir}/cli-roundtrip.tmp.ts`;
  try {
    const wrote = await run(["--url", url as string, "--out", out]);
    expect(wrote.code).toBe(0);
    expect(await Bun.file(out).text()).toContain("defineSchema({");
    // The note goes to stderr and does not fail the run: a table this package
    // cannot describe is a thing to say, not a reason to write nothing.
    expect(wrote.err).toContain("events has no primary key");

    const checked = await run(["--url", url as string, "--out", out, "--check"]);
    expect(checked.code).toBe(0);
    expect(checked.err).toContain("matches the database");
  } finally {
    await unlink(out).catch(() => {});
  }
});

live("--check exits non-zero on a file the database has moved past", async () => {
  const out = `${import.meta.dir}/cli-drift.tmp.ts`;
  try {
    await Bun.write(
      out,
      `import { defineSchema, type Schema } from "@smartput/query";

export const schema: Schema = defineSchema({
  tables: [{ name: "orders", key: "id", columns: [{ name: "id", as: "number" }] }],
});
`,
    );
    const { code, err } = await run(["--url", url as string, "--out", out, "--check"]);
    expect(code).toBe(1);
    expect(err).toContain("has drifted from the database");
    expect(err).toContain("new-column     orders.total_cents");
    expect(err).toContain("new-table      customers");
  } finally {
    await unlink(out).catch(() => {});
  }
});
