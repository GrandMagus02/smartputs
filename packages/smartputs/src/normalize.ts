// Generated facade over `@smartput/core/normalize` — see `packages/smartputs/README.md` for why
// this package exists, and `parity.test.ts` for what keeps this list honest.
//
// The runtime names are spelled out rather than star-re-exported, and that is
// not a style preference. `export * from` an external package survives into
// `dist` as a star, and a consumer bundling a named import against that dist
// gets "No matching export" — the failure `@smartput/core`'s own `errors.ts`
// carries a comment about, hit for real during the kind extraction.
// `export type *` is safe by contrast: it emits nothing at all, so no star is
// left in the JavaScript.

export type * from "@smartput/core/normalize";
export {
  Normalizer,
  normalize,
} from "@smartput/core/normalize";
