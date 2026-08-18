// `@smartput/core/print` — formatting a `Value` back to text (spec §6).
// `formatValue`/`formatNumber`/`DISPLAY_PRECISION` are re-exported by
// `print/print.ts` itself (their one home is `format/format.ts`), so this
// file re-exports through it rather than reaching around it.
export type {
  DisplayOptions,
  FormatOptions,
  PrinterOptions,
  PrintMode,
  PrintOptions,
} from "./print/print";
export {
  applyDisplay,
  DEFAULT_DISPLAY,
  DISPLAY_PRECISION,
  formatNumber,
  formatValue,
  Printer,
} from "./print/print";
