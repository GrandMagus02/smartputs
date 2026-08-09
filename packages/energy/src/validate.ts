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
import { ENERGY_UNITS, type EnergyUnit } from "./units";

export type { EnergyUnit } from "./units";
export { ENERGY_UNITS } from "./units";

type O = ParseOptions<EnergyUnit>;
type I = Input<EnergyUnit>;

// Arrow wrappers, not factory closures: a factory call at module scope would
// need /*#__PURE__*/ on every line to shake, and one of them would eventually
// be forgotten.
export const parseEnergy = (input: string, opts?: O) => parse(ENERGY_UNITS, input, opts);
export const isEnergy = (input: string, opts?: O) => is(ENERGY_UNITS, input, opts);
export const addEnergy = (a: I, b: I, opts?: O) => add(ENERGY_UNITS, a, b, opts);
export const subEnergy = (a: I, b: I, opts?: O) => sub(ENERGY_UNITS, a, b, opts);
export const scaleEnergy = (a: I, factor: number, opts?: O) =>
  scale(ENERGY_UNITS, a, factor, opts);
export const negateEnergy = (a: I, opts?: O) => negate(ENERGY_UNITS, a, opts);
export const toEnergy = (a: I, to: EnergyUnit, opts?: O) =>
  convert(ENERGY_UNITS, a, to, opts);
export const asEnergy = (a: I, to: EnergyUnit, opts?: O) => as(ENERGY_UNITS, a, to, opts);
export const equalsEnergy = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(ENERGY_UNITS, a, b, epsilon, opts);
export const compareEnergy = (a: I, b: I, opts?: O) => compare(ENERGY_UNITS, a, b, opts);
export const formatEnergy = (a: Ok<EnergyUnit>) => format(ENERGY_UNITS, a);
export const patternForEnergy = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(ENERGY_UNITS, opts);
