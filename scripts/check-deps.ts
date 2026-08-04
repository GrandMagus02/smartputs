const pkg = await Bun.file("packages/core/package.json").json();
const deps = Object.keys(pkg.dependencies ?? {});
const allowed = ["decimal.js"];
const extra = deps.filter((d) => !allowed.includes(d));

if (extra.length > 0) {
  console.error(
    `@smartput/core must have exactly one runtime dependency (decimal.js). Found extra: ${extra.join(", ")}`,
  );
  process.exit(1);
}
console.log(`@smartput/core dependencies OK: ${deps.join(", ")}`);
