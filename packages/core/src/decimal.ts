// Moved to `@smartput/kind` when the kinds stopped depending on the engine.
// Re-exported from the path it always had so that core's seventy-six import
// sites — and anyone who reached `@smartput/core/decimal` — keep working, and
// so that `Decimal.set({ precision: 28 })` still runs exactly once, from the
// one module that owns it.
export { Decimal } from "@smartput/kind/decimal";
