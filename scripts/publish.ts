import { rm, writeFile } from "node:fs/promises";
import { rootDir } from "./build";
import {
  readWorkspace,
  type StagedPackage,
  stageAll,
  stagePackage,
  stageRoot,
  topoOrder,
} from "./pack";

/**
 * Publishes the workspace to npm, one package at a time, asking for the auth
 * token before each one.
 *
 * A token per package is the point rather than an inconvenience. npm's granular
 * tokens scope to a package list, so the first publish of 37 packages is the
 * one moment where a single token with write access to the whole scope would
 * otherwise sit in a shell history; asking each time keeps every token narrow
 * and short-lived, and a token pasted here never touches `~/.npmrc` — it goes
 * into a 0600 file inside the staging directory that this script deletes in a
 * `finally`.
 *
 * Order comes from the dependency graph (see `topoOrder`): npm validates that a
 * dependency range resolves to something published, so `@smartput/kind` has to
 * land before the twenty packages that depend on it.
 *
 * The run is resumable. Before publishing anything it asks the registry which
 * versions exist and skips what is already there, so a token typo at package 19
 * costs you package 19 and not the eighteen before it.
 *
 *   bun run publish-packages                     # interactive, prompts per package
 *   bun run publish-packages --dry-run           # stage + pack, publish nothing
 *   bun run publish-packages --only @smartput/kind,@smartput/shared
 *   bun run publish-packages --version 0.1.0     # stamp a first version everywhere
 *   bun run publish-packages --ci                # token from NPM_TOKEN, no prompts
 *   bun run publish-packages --no-open           # do not open the token page
 */

const REGISTRY = "https://registry.npmjs.org";
const FIRST_VERSION = "0.1.0";

interface Args {
  dryRun: boolean;
  /** Open npm’s token page in a browser before the first prompt. */
  open: boolean;
  ci: boolean;
  skipChecks: boolean;
  only: string[] | undefined;
  version: string | undefined;
  distTag: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: argv.includes("--dry-run"),
    open: !argv.includes("--no-open"),
    ci: argv.includes("--ci"),
    skipChecks: argv.includes("--skip-checks"),
    only: undefined,
    version: undefined,
    distTag: "latest",
  };
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const only = value("--only");
  if (only)
    args.only = only
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  args.version = value("--version");
  args.distTag = value("--tag") ?? "latest";
  return args;
}

/** Runs a command, streaming nothing, returning what it said. */
async function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

/** A line of input with the terminal echo off, so a token never lands on screen. */
async function promptSecret(label: string): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(label);
  if (!stdin.isTTY) {
    const piped = await new Response(Bun.stdin.stream()).text();
    process.stdout.write("\n");
    return piped.trim();
  }
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise<string>((resolve) => {
    let buffer = "";
    const done = (value: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(buffer);
        // Ctrl-C mid-prompt has to restore the terminal before it leaves.
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") buffer = buffer.slice(0, -1);
        else if (ch >= " ") buffer += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/**
 * Who npm thinks you are, from whatever config is already on this machine.
 *
 * Only ever used to build a URL, so a failure is not one: an unauthenticated
 * shell gets the generic page and types its own username once, which is a
 * better outcome than refusing to help because we could not personalise a link.
 */
async function npmUsername(): Promise<string | undefined> {
  const { stdout, exitCode } = await run(
    ["npm", "whoami", "--registry", REGISTRY],
    rootDir,
  );
  const name = stdout.trim();
  return exitCode === 0 && name ? name : undefined;
}

/**
 * Opens a URL in whatever the platform calls a browser, and does not care if it
 * cannot. Over SSH, in a container, or on a box with no desktop there is
 * nothing to open — the URL is printed either way, which is the half that has
 * to work.
 */
async function openUrl(url: string): Promise<boolean> {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

/**
 * Points a browser at npm's token page, once per run, just before the first
 * token is asked for.
 *
 * Once, not per package: the prompt loop reuses the last token on an empty
 * line, so a run that opened a tab for each of 38 packages would be punishing
 * the ergonomic path. And lazily rather than up front, because a rerun that
 * finds everything already published never asks for a token at all and should
 * not steal focus to say so.
 *
 * The "All packages" line is not a style note. npm's granular tokens scope to a
 * list of packages that already exist, so on a first publish there is nothing
 * to select and a scoped token 403s on every one of them — the failure reads as
 * an auth problem and is really a chicken-and-egg one.
 */
async function offerTokenPage(): Promise<void> {
  const user = await npmUsername();
  const url = user
    ? `https://www.npmjs.com/settings/${user}/tokens/granular-access-tokens/new`
    : "https://www.npmjs.com/login?next=/settings";

  console.log("\n  a token is needed. npm's token page:");
  console.log(`    ${url}`);
  if (user === undefined) {
    console.log("    (not logged in here — sign in, then Access Tokens → Generate)");
  }
  console.log(
    "    for a FIRST publish choose Packages and scopes → All packages: a granular",
  );
  console.log("    token lists packages that already exist, and none of these do yet.");
  if (!(await openUrl(url))) {
    console.log("    (could not open a browser — copy the link above)");
  }
}

/** A visible line, for answers that are not secrets. */
async function promptLine(label: string): Promise<string> {
  process.stdout.write(label);
  for await (const line of console) return line.trim();
  return "";
}

/** Versions already on the registry, so a rerun skips what it already did. */
async function publishedVersions(name: string): Promise<Set<string>> {
  const { stdout, exitCode } = await run(
    ["npm", "view", name, "versions", "--json", "--registry", REGISTRY],
    rootDir,
  );
  if (exitCode !== 0) return new Set(); // 404: nothing published under this name yet
  try {
    const parsed = JSON.parse(stdout);
    return new Set(Array.isArray(parsed) ? parsed : [parsed]);
  } catch {
    return new Set();
  }
}

/**
 * Publishes one staged directory with a token that lives only as long as the
 * call. `--userconfig` keeps npm from reading (or writing) the developer's own
 * `~/.npmrc`, which is what makes "a token per package" true rather than
 * decorative.
 */
async function publishStaged(
  staged: { name: string; version: string; stagedDir: string },
  token: string,
  distTag: string,
  provenance: boolean,
): Promise<boolean> {
  const npmrc = `${staged.stagedDir}/.npmrc-publish`;
  const host = REGISTRY.replace(/^https?:/, "");
  await writeFile(npmrc, `${host}/:_authToken=${token}\nregistry=${REGISTRY}\n`, {
    mode: 0o600,
  });

  const publish = async (otp?: string) =>
    run(
      [
        "npm",
        "publish",
        "--access",
        "public",
        "--tag",
        distTag,
        "--registry",
        REGISTRY,
        "--userconfig",
        npmrc,
        ...(provenance ? ["--provenance"] : []),
        ...(otp ? ["--otp", otp] : []),
      ],
      staged.stagedDir,
      { npm_config_userconfig: npmrc },
    );

  try {
    let result = await publish();
    // A classic token with 2FA-on-publish answers EOTP once; ask and retry
    // rather than making the whole run start over.
    if (result.exitCode !== 0 && /EOTP|one-time pass/i.test(result.stderr)) {
      const otp = await promptLine("  one-time password: ");
      result = await publish(otp);
    }
    if (result.exitCode !== 0) {
      console.error(`  FAILED ${staged.name}@${staged.version}`);
      console.error(
        result.stderr
          .trim()
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      );
      return false;
    }
    console.log(`  published ${staged.name}@${staged.version}`);
    return true;
  } finally {
    await rm(npmrc, { force: true });
  }
}

/** Size of the tarball npm would send, reported so a surprise is visible. */
async function tarballBytes(stagedDir: string): Promise<number> {
  const { stdout, exitCode } = await run(
    ["npm", "pack", "--dry-run", "--json"],
    stagedDir,
  );
  if (exitCode !== 0) return 0;
  try {
    return JSON.parse(stdout)[0]?.size ?? 0;
  } catch {
    return 0;
  }
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspace = await readWorkspace();

  // A first publish has to stamp a real version: `0.0.0` is a placeholder, and
  // a dependency range of `^0.0.0` would point at something nobody can install.
  // The stamp is decided here and written only when the run is real, so
  // `--dry-run` leaves the workspace exactly as it found it.
  const target = args.version ?? FIRST_VERSION;
  const versions = new Map(
    [...workspace].map(([name, { pkg }]) => [name, pkg.version as string]),
  );
  const restamp = [...workspace].filter(
    ([, { pkg }]) => args.version !== undefined || pkg.version === "0.0.0",
  );
  for (const [name] of restamp) versions.set(name, target);

  if (restamp.length > 0) {
    console.log(
      `${args.dryRun ? "would stamp" : "stamping"} ${restamp.length} package(s) at ${target}`,
    );
    if (!args.dryRun) {
      for (const [, { dir, pkg }] of restamp) {
        pkg.version = target;
        const path = `${rootDir}/${dir}/package.json`;
        const text = await Bun.file(path).text();
        await Bun.write(path, text.replace(/("version":\s*)"[^"]*"/, `$1"${target}"`));
      }
    }
  }

  if (!args.skipChecks && !args.dryRun) {
    console.log("running `bun run check` …");
    const check = Bun.spawn(["bun", "run", "check"], {
      cwd: rootDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if ((await check.exited) !== 0) {
      console.error("checks failed — nothing published.");
      process.exit(1);
    }
  } else {
    // The staged manifests promise `dist/…`; without a build there is nothing
    // to promise. `--skip-checks` skips the test run, not the build.
    const build = Bun.spawn(["bun", "run", "build"], {
      cwd: rootDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if ((await build.exited) !== 0) {
      console.error("build failed — nothing published.");
      process.exit(1);
    }
  }

  const order = topoOrder(workspace).filter(
    (name) => !args.only || args.only.includes(name),
  );
  if (args.only) {
    const unknown = args.only.filter((n) => !workspace.has(n));
    if (unknown.length > 0) {
      console.error(`unknown package(s): ${unknown.join(", ")}`);
      process.exit(1);
    }
  }

  await rm(stageRoot, { recursive: true, force: true });
  const staged = await stageAll(order, versions);

  console.log(`\n${staged.length} package(s), in dependency order:`);
  for (const p of staged) {
    console.log(`  ${p.name}@${p.version}  ${kb(await tarballBytes(p.stagedDir))}`);
  }

  if (args.dryRun) {
    console.log(`\ndry run — staged in ${stageRoot}, nothing published.`);
    return;
  }

  const existing = new Map(
    await Promise.all(
      staged.map(async (p) => [p.name, await publishedVersions(p.name)] as const),
    ),
  );

  const ciToken = process.env.NPM_TOKEN ?? process.env.NODE_AUTH_TOKEN ?? "";
  if (args.ci && !ciToken) {
    console.error("--ci needs NPM_TOKEN (or NODE_AUTH_TOKEN) in the environment.");
    process.exit(1);
  }

  let lastToken = "";
  let offeredTokenPage = false;
  const done: StagedPackage[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const pkg of staged) {
    if (existing.get(pkg.name)?.has(pkg.version)) {
      console.log(`\n${pkg.name}@${pkg.version} is already on npm — skipping.`);
      skipped.push(pkg.name);
      continue;
    }

    console.log(`\n${pkg.name}@${pkg.version}`);
    let token = ciToken;
    if (!args.ci) {
      if (args.open && !offeredTokenPage) {
        offeredTokenPage = true;
        await offerTokenPage();
      }
      token = await promptSecret(
        `  npm token for ${pkg.name}${lastToken ? " (empty reuses the last one)" : ""}: `,
      );
      if (!token && lastToken) token = lastToken;
      if (!token) {
        console.log("  no token given — skipping.");
        skipped.push(pkg.name);
        continue;
      }
      lastToken = token;
    }

    // Provenance is an OIDC signature over the workflow that built the
    // tarball; asking for one outside Actions just fails the publish.
    const provenance = process.env.GITHUB_ACTIONS === "true";
    const ok = await publishStaged(pkg, token, args.distTag, provenance);
    if (ok) done.push(pkg);
    else {
      failed.push(pkg.name);
      // Stopping matters: everything after this point may depend on what just
      // failed, and npm would reject those with a confusing range error.
      console.error("  stopping — later packages depend on this one.");
      break;
    }
  }

  // Tags are what the next release reads. `release.ts` computes a bump from
  // the commits since `<name>@<version>`, so a publish that leaves no tag makes
  // the following release re-read the whole history and bump every package
  // again. In CI the workflow tags before it publishes; here it happens after,
  // and only for what actually went out.
  if (!args.ci && done.length > 0) {
    for (const pkg of done) {
      const tag = `${pkg.name}@${pkg.version}`;
      const { exitCode, stderr } = await run(
        ["git", "tag", "-a", tag, "-m", tag],
        rootDir,
      );
      if (exitCode !== 0) console.error(`  could not tag ${tag}: ${stderr.trim()}`);
    }
    console.log(
      `\ntagged ${done.length} release(s) — push them with \`git push --tags\`.`,
    );
  }

  console.log(
    `\npublished ${done.length}, skipped ${skipped.length}, failed ${failed.length}` +
      (failed.length ? `: ${failed.join(", ")}` : ""),
  );
  if (failed.length > 0) process.exit(1);
}

if (import.meta.main) await main();

export { parseArgs, publishedVersions, publishStaged, stagePackage };
