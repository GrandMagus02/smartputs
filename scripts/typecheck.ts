import { Glob } from "bun";

/**
 * Typechecks every workspace package. The root script used to hardcode one
 * `tsc -p ...` invocation per package chained with `&&`, which meant a new
 * package was only checked once someone remembered to extend the chain — and
 * `&&` stops at the first failure, so you fix one package to discover the next.
 * This discovers packages from the filesystem instead, runs them all, and
 * reports every failure in one pass.
 */

const root = new URL("..", import.meta.url);
const found = [...new Glob("packages/*/tsconfig.json").scanSync(root.pathname)]
  .map((p) => p.replaceAll("\\", "/"))
  .sort();

let failed = false;

if (found.length === 0) {
  console.error("typecheck found no packages/*/tsconfig.json — refusing to pass.");
  failed = true;
}

/**
 * Spawned in parallel — tsc is slow to start and sixteen cold starts in series
 * is a minute of nothing. Output is buffered per package and printed below in
 * glob order so the log stays readable regardless of who finishes first.
 *
 * `tsc` resolves off node_modules/.bin, which `bun run` puts on PATH for us.
 */
const results = await Promise.all(
  found.map(async (path) => {
    const proc = Bun.spawn(["tsc", "-p", path, "--noEmit"], {
      cwd: root.pathname,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { path, output: (stdout + stderr).trim(), exitCode };
  }),
);

for (const { path, output, exitCode } of results) {
  if (exitCode === 0) {
    console.log(`${path} typecheck OK`);
  } else {
    console.error(`${path} typecheck FAILED`);
    if (output) console.error(output);
    failed = true;
  }
}

if (failed) process.exit(1);
