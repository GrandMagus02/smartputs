/**
 * Every built-in kind's value class, in one import.
 *
 * **This is not the byte-safe entry point.** A per-kind subpath —
 * `@smartput/angle/class` — shakes to that kind's table and the shared factory,
 * under any bundler. This barrel only shakes as well as your bundler follows
 * re-exports. Each class is a `/*#__PURE__*\/`-annotated `createValueClass`
 * call, so a bundler that both follows re-exports and honours the annotation
 * drops the unused ones; one that does neither constructs all seventeen. Reach
 * for the subpath in anything shipped to a browser.
 *
 * `Number` shadows the JS global when imported bare. That is the naming scheme
 * — the class is named for its kind — so prefer `import { Number as Num }` or
 * the `@smartput/number/class` subpath if the shadowing bothers you.
 *
 * `measure` is here even though it is absent from `BUILTIN_KINDS`: the
 * exclusion exists because its `mm`/`cm` aliases collide with `length` inside a
 * single engine registry, and these classes share no registry. Nothing is
 * ambiguous about holding a `Measure` and a `Length` at the same time.
 */
export * from "@smartput/angle/class";
export * from "@smartput/area/class";
export * from "@smartput/datarate/class";
export * from "@smartput/datasize/class";
export * from "@smartput/duration/class";
export * from "@smartput/energy/class";
export * from "@smartput/length/class";
export * from "@smartput/mass/class";
export * from "@smartput/measure/class";
export * from "@smartput/number/class";
export * from "@smartput/percent/class";
export * from "@smartput/power/class";
export * from "@smartput/speed/class";
export * from "@smartput/temperature/class";
export * from "@smartput/tempo/class";
export * from "@smartput/volume/class";
