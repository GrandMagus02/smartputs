// Moved to `@smartput/kind`; re-exported here for the reason `decimal.ts` gives.
//
// These are the types a *kind* and a *language* are written in — `Kind`,
// `Value`, `Vocabulary`, `Language`, `OpSignature` — not the pipeline's own.
// The engine's types (`Engine`, `Token`, `Node`, `Result`) never lived here and
// still do not: they are declared beside the stage that produces them.
export * from "@smartput/kind/types";
