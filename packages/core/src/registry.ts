// `@smartput/core/registry` — the seam a hand-built pipeline needs (spec §6):
// `buildRegistry` turns a set of kinds into the `Registry` every other stage
// takes, `defineKind` is how a kind is declared in the first place, and
// `createResolver` is what closes the gap `stages.test.ts` used to reach
// around the barrel for — it and the `Resolver` type it returns are
// `Parser`'s one required config field.

export { defineKind } from "./kind/define";
export type { AliasEntry, CueEntry, Registry } from "./kind/registry";
export { buildRegistry } from "./kind/registry";
export type { Resolver } from "./parse/candidates";
export { createResolver } from "./parse/candidates";
