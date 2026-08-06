import {
  add,
  as,
  compare,
  convert,
  equals,
  format,
  type Input,
  is,
  negate,
  type Ok,
  type ParseOptions,
  parse,
  patternFor,
  scale,
  sub,
} from "@smartput/shared";
import { DATARATE_UNITS, type DatarateUnit } from "./units";

export type { DatarateUnit } from "./units";
export { DATARATE_UNITS } from "./units";

type O = ParseOptions<DatarateUnit>;
type I = Input<DatarateUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseDatarate = (input: string, opts?: O) =>
  parse(DATARATE_UNITS, input, opts);
export const isDatarate = (input: string, opts?: O) => is(DATARATE_UNITS, input, opts);
export const addDatarate = (a: I, b: I, opts?: O) => add(DATARATE_UNITS, a, b, opts);
export const subDatarate = (a: I, b: I, opts?: O) => sub(DATARATE_UNITS, a, b, opts);
export const scaleDatarate = (a: I, factor: number, opts?: O) =>
  scale(DATARATE_UNITS, a, factor, opts);
export const negateDatarate = (a: I, opts?: O) => negate(DATARATE_UNITS, a, opts);
export const toDatarate = (a: I, to: DatarateUnit, opts?: O) =>
  convert(DATARATE_UNITS, a, to, opts);
export const asDatarate = (a: I, to: DatarateUnit, opts?: O) =>
  as(DATARATE_UNITS, a, to, opts);
export const equalsDatarate = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(DATARATE_UNITS, a, b, epsilon, opts);
export const compareDatarate = (a: I, b: I, opts?: O) =>
  compare(DATARATE_UNITS, a, b, opts);
export const formatDatarate = (a: Ok<DatarateUnit>) => format(DATARATE_UNITS, a);
export const patternForDatarate = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(DATARATE_UNITS, opts);
