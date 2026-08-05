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
import { MASS_UNITS, type MassUnit } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

type O = ParseOptions<MassUnit>;
type I = Input<MassUnit>;

export const parseMass = (input: string, opts?: O) => parse(MASS_UNITS, input, opts);
export const isMass = (input: string, opts?: O) => is(MASS_UNITS, input, opts);
export const addMass = (a: I, b: I, opts?: O) => add(MASS_UNITS, a, b, opts);
export const subMass = (a: I, b: I, opts?: O) => sub(MASS_UNITS, a, b, opts);
export const scaleMass = (a: I, factor: number, opts?: O) =>
  scale(MASS_UNITS, a, factor, opts);
export const negateMass = (a: I, opts?: O) => negate(MASS_UNITS, a, opts);
export const toMass = (a: I, to: MassUnit, opts?: O) => convert(MASS_UNITS, a, to, opts);
export const asMass = (a: I, to: MassUnit, opts?: O) => as(MASS_UNITS, a, to, opts);
export const equalsMass = (a: I, b: I, epsilon?: number, opts?: O) =>
  equals(MASS_UNITS, a, b, epsilon, opts);
export const compareMass = (a: I, b: I, opts?: O) => compare(MASS_UNITS, a, b, opts);
export const formatMass = (a: Ok<MassUnit>) => format(MASS_UNITS, a);
export const patternForMass = (opts?: { mode?: "strict" | "loose" }) =>
  patternFor(MASS_UNITS, opts);
