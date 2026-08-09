// `@smartput/core/solve` — candidate resolution alone (spec §6): `Solver`
// picks the best `Resolution` over a `Program`'s candidates, and
// `weightBreakdown` is the same per-candidate accounting `explain()` uses,
// without pulling in the evaluator or printer.
export type { Resolution } from "./solve/solver";
export type { SolverOptions } from "./solve/solver-class";
export { Solver } from "./solve/solver-class";
export { weightBreakdown } from "./solve/weights";
