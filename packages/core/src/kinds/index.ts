import type { Kind } from "../types";
import { angle } from "./angle";
import { datasize } from "./datasize";
import { area, speed, volume } from "./derived";
import { duration } from "./duration";
import { length } from "./length";
import { mass } from "./mass";
import { measure } from "./measure";
import { number } from "./number";
import { percent } from "./percent";
import { tempdelta, temperature } from "./temperature";

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
