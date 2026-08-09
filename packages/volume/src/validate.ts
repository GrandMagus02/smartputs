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
import { VOLUME_UNITS, type VolumeUnit } from "./units";

export type { VolumeUnit } from "./units";
export { VOLUME_UNITS } from "./units";

type O = ParseOptions<VolumeUnit>;
type I = Input<VolumeUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseVolume = (input: string, opts?: O) => parse(VOLUME_UNITS, input, opts);
export const isVolume = (input: string, opts?: O) => is(VOLUME_UNITS, input, opts);
export const addVolume = (a: I, b: I, opts?: O) => add(VOLUME_UNITS, a, b, opts);
export const subVolume = (a: I, b: I, opts?: O) => sub(VOLUME_UNITS, a, b, opts);
export const scaleVolume = (a: I, factor: number, opts?: O) =>
  scale(VOLUME_UNITS, a, factor, opts);
export const negateVolume = (a: I, opts?: O) => negate(VOLUME_UNITS, a, opts);
export const toVolume = (a: I, to: VolumeUnit, opts?: O) =>
  convert(VOLUME_UNITS, a, to, opts);
export const asVolume = (a: I, to: VolumeUnit, opts?: O) => as(VOLUME_UNITS, a, to, opts);
export const equalsVolume = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(VOLUME_UNITS, a, b, epsilon, opts);
export const compareVolume = (a: I, b: I, opts?: O) => compare(VOLUME_UNITS, a, b, opts);
export const formatVolume = (a: Ok<VolumeUnit>) => format(VOLUME_UNITS, a);
export const patternForVolume = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(VOLUME_UNITS, opts);
