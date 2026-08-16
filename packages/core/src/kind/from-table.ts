// Moved to `@smartput/kind`; re-exported here for the reason `../decimal.ts` gives.
//
// Two upstream modules, one shim: `aliasesFor` and `RatioTable` moved again on
// 2026-08-16, out of kind's `from-table.ts` and into its `aliases.ts`, so that
// naming the alias helper stops linking decimal.js. This file's surface is
// unchanged — that is the point of a shim — but the import below has to name
// the new subpath, or core would drag the ratio machinery back in through the
// door the split was cut to close.
export type { RatioTable } from "@smartput/kind/aliases";
export { aliasesFor } from "@smartput/kind/aliases";
export { decimalRatios } from "@smartput/kind/from-table";
