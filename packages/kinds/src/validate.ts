/**
 * Every built-in kind's free-function validate surface, in one import.
 *
 * **This is not the byte-safe entry point.** A per-kind subpath —
 * `@smartput/angle/validate` — shakes to that kind's table and nothing else,
 * under any bundler, because there is nothing else in the module. This barrel
 * only shakes as well as your bundler follows re-exports: esbuild, Rollup and
 * modern webpack drop the unused kinds, but a bundler that does not, or a
 * CommonJS consumer, pulls all thirteen tables and the shared parser. Reach for
 * it when you genuinely want most of the kinds, or in a Node script where size
 * does not matter; reach for the subpath in anything shipped to a browser.
 *
 * Names never collide: every function is suffixed with its kind, so
 * `parseAngle` and `parseMass` coexist and `export *` is unambiguous. Each
 * module also re-exports its own `<KIND>_UNITS` table and unit type.
 *
 * `temperature` contributes two kinds — the affine reading and its delta — so
 * `diffTemperature` appears without an `addTemperature`, and the delta's full
 * ratio surface arrives as `addTempDelta` and friends. That asymmetry is the
 * kind model, not an oversight: see spec §7.4.
 */
export * from "@smartput/angle/validate";
export * from "@smartput/area/validate";
export * from "@smartput/datasize/validate";
export * from "@smartput/duration/validate";
export * from "@smartput/length/validate";
export * from "@smartput/mass/validate";
export * from "@smartput/measure/validate";
export * from "@smartput/number/validate";
export * from "@smartput/percent/validate";
export * from "@smartput/speed/validate";
export * from "@smartput/temperature/validate";
export * from "@smartput/volume/validate";
