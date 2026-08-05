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
} from "@smartput/validate";
import { DATASIZE_UNITS, type DatasizeUnit } from "./units";

export type { DatasizeUnit } from "./units";
export { DATASIZE_UNITS } from "./units";

type O = ParseOptions<DatasizeUnit>;
type I = Input<DatasizeUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseDatasize = (input: string, opts?: O) =>
  parse(DATASIZE_UNITS, input, opts);
export const isDatasize = (input: string, opts?: O) => is(DATASIZE_UNITS, input, opts);
export const addDatasize = (a: I, b: I, opts?: O) => add(DATASIZE_UNITS, a, b, opts);
export const subDatasize = (a: I, b: I, opts?: O) => sub(DATASIZE_UNITS, a, b, opts);
export const scaleDatasize = (a: I, factor: number, opts?: O) =>
  scale(DATASIZE_UNITS, a, factor, opts);
export const negateDatasize = (a: I, opts?: O) => negate(DATASIZE_UNITS, a, opts);
export const toDatasize = (a: I, to: DatasizeUnit, opts?: O) =>
  convert(DATASIZE_UNITS, a, to, opts);
export const asDatasize = (a: I, to: DatasizeUnit, opts?: O) =>
  as(DATASIZE_UNITS, a, to, opts);
export const equalsDatasize = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(DATASIZE_UNITS, a, b, epsilon, opts);
export const compareDatasize = (a: I, b: I, opts?: O) =>
  compare(DATASIZE_UNITS, a, b, opts);
export const formatDatasize = (a: Ok<DatasizeUnit>) => format(DATASIZE_UNITS, a);
export const patternForDatasize = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(DATASIZE_UNITS, opts);
