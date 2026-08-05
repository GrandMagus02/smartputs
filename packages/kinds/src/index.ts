import { angle } from "@smartput/angle";
import { area } from "@smartput/area";
import type { Kind } from "@smartput/core";
import { datasize } from "@smartput/datasize";
import { duration } from "@smartput/duration";
import { length } from "@smartput/length";
import { mass } from "@smartput/mass";
import { measure } from "@smartput/measure";
import { number } from "@smartput/number";
import { percent } from "@smartput/percent";
import { speed } from "@smartput/speed";
import { tempdelta, temperature } from "@smartput/temperature";
import { volume } from "@smartput/volume";

// Every built-in kind is exported by name, not only as an anonymous member of
// BUILTIN_KINDS. `measure` in particular has no other route: it is deliberately
// left out of BUILTIN_KINDS (its mm/cm aliases collide with `length`), so
// opting in by name is the only way to use it at all.
export {
  angle,
  area,
  datasize,
  duration,
  length,
  mass,
  measure,
  number,
  percent,
  speed,
  tempdelta,
  temperature,
  volume,
};

/**
 * The standard set. `measure` is deliberately excluded: its `mm`/`cm` aliases
 * collide with `length`, so registering both by default would make "10 cm"
 * ambiguous for every consumer. Callers who want typographic units opt in.
 */
export const BUILTIN_KINDS: Kind[] = [
  number,
  percent,
  length,
  mass,
  duration,
  temperature,
  tempdelta,
  angle,
  datasize,
  speed,
  area,
  volume,
];
