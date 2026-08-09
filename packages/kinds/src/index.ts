import { angle } from "@smartput/angle";
import { area } from "@smartput/area";
import { boolean } from "@smartput/boolean";
import type { Kind } from "@smartput/core";
import { datarate } from "@smartput/datarate";
import { datasize } from "@smartput/datasize";
import { duration } from "@smartput/duration";
import { energy } from "@smartput/energy";
import { length } from "@smartput/length";
import { mass } from "@smartput/mass";
import { measure } from "@smartput/measure";
import { number } from "@smartput/number";
import { percent } from "@smartput/percent";
import { power } from "@smartput/power";
import { speed } from "@smartput/speed";
import { tempdelta, temperature } from "@smartput/temperature";
import { tempo } from "@smartput/tempo";
import { volume } from "@smartput/volume";

// Every built-in kind is exported by name, not only as an anonymous member of
// BUILTIN_KINDS. `measure` in particular has no other route: it is deliberately
// left out of BUILTIN_KINDS (its mm/cm aliases collide with `length`), so
// opting in by name is the only way to use it at all.
export {
  angle,
  area,
  boolean,
  datarate,
  datasize,
  duration,
  energy,
  length,
  mass,
  measure,
  number,
  percent,
  power,
  speed,
  tempdelta,
  temperature,
  tempo,
  volume,
};

/**
 * The standard set. `measure` is deliberately excluded: its `mm`/`cm` aliases
 * collide with `length`, so registering both by default would make "10 cm"
 * ambiguous for every consumer. Callers who want typographic units opt in.
 *
 * The bridging kinds are here for a second reason beyond being useful on their
 * own. `datarate`, `energy` and `tempo` declare ops that name their operand
 * kinds by string — `datasize`, `duration`, `power` — and registry pass 4 keys
 * the op table without checking that those ids exist, so a signature whose
 * operands are not registered alongside it is silently unreachable rather than
 * an error. Shipping the whole set together is what makes "500 mb / 20 s" and
 * "2 kw * 3 h" answerable out of the box.
 */
export const BUILTIN_KINDS: Kind[] = [
  // First, and not for ordering's sake: it is what every comparison signature
  // core generates names as its result, so an engine without it can parse
  // `1 kg > 500 g` and then fail to format the answer. It registers no alias
  // and no operation of its own, so adding it claims no word and changes no
  // existing reading.
  boolean,
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
  datarate,
  power,
  energy,
  tempo,
];
