const ALLOWED: Record<string, string[]> = {
  "packages/core/package.json": ["decimal.js"],
  "packages/rates/package.json": ["decimal.js", "@smartput/core"],
};

let failed = false;
for (const [path, allowed] of Object.entries(ALLOWED)) {
  const pkg = await Bun.file(path).json();
  const deps = Object.keys(pkg.dependencies ?? {});
  const extra = deps.filter((d) => !allowed.includes(d));
  if (extra.length > 0) {
    console.error(
      `${pkg.name} may depend only on ${allowed.join(", ")}. Found extra: ${extra.join(", ")}`,
    );
    failed = true;
  } else {
    console.log(`${pkg.name} dependencies OK: ${deps.join(", ") || "(none)"}`);
  }
}
if (failed) process.exit(1);
