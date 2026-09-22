import {
  createValueClass,
  type Input,
  type ValueClass,
  type ValueInstance,
} from "@smartput/shared";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "./units";

export type { TempDeltaUnit, TemperatureUnit } from "./units";

/** An ordinary ratio class: `add`, `sub`, `scale`, `negate`, no `diff`. */
export const TempDelta = /*#__PURE__*/ createValueClass(TEMPDELTA_UNITS, "tempdelta");

/** Anything the delta side of an affine operation accepts. */
export type DeltaInput = Input<TempDeltaUnit> | ValueInstance<TempDeltaUnit>;
export type ReadingInput = Input<TemperatureUnit> | ValueInstance<TemperatureUnit>;

/**
 * The factory omits `add`/`sub`/`scale`/`negate` on an affine table and adds
 * `diff`. `add` comes back here, and only here, because a reading plus a
 * *difference* is the one affine sum that means something — the same exception
 * the descriptor states as an `OpSignature` (`temperature + tempdelta ->
 * temperature`). It is not general: the operand is a `TempDelta`, never
 * another `Temperature`, and the type says so.
 */
export interface TemperatureInstance extends ValueInstance<TemperatureUnit> {
  diff(other: ReadingInput): ValueInstance<TempDeltaUnit>;
  add(delta: DeltaInput): TemperatureInstance;
}

/**
 * `ValueClass`'s second parameter is the instance type, so the statics come
 * back narrowed without restating one of them — the three overrides that used
 * to live here said only what the parameter now says.
 */
export type TemperatureClass = ValueClass<TemperatureUnit, TemperatureInstance>;

/**
 * Patching the prototype rather than subclassing: the factory's statics close
 * over their own class, so `Temperature.parse` on a subclass would still hand
 * back a base instance and the `add` this file exists to provide would be
 * missing from it. The cast is because a `ValueClass` is described by a
 * construct signature, which carries no `prototype`.
 */
function withDeltaAdd(base: ValueClass<TemperatureUnit>): TemperatureClass {
  const Temp = base as TemperatureClass;
  Object.assign((base as unknown as { prototype: object }).prototype, {
    add(this: TemperatureInstance, delta: DeltaInput): TemperatureInstance {
      // Read through the *delta* table, which has no offsets: "5f" as a
      // difference is 5/9 of a degree Celsius of warming, not -15C.
      //
      // `d.to` and not `fromCanonical(toCanonical(...))`: `to` goes through
      // `rebase`, which returns the magnitude untouched when the delta is
      // already in the reading's unit. The hand-rolled round trip skipped that
      // short-circuit and multiplied and divided by 5/9 for nothing, so
      // "0.9f + 0.9f" came back 1.7999999999999998 -- the identity the spec
      // names with "30deg - 15deg".
      const d = TempDelta.from(delta);
      const shift = d.to(this.unit);
      // The reading keeps its own unit, matching the left-operand-wins rule
      // the ratio ops follow, and the shift is added where the reading already
      // is -- so 30c + 5c is 35, not 34.99999999999999.
      return new Temp(this.value + shift, this.unit);
    },
  });
  return Temp;
}

/** An affine class: `diff` and the delta-only `add`, no product and no sum. */
export const Temperature: TemperatureClass = /*#__PURE__*/ withDeltaAdd(
  /*#__PURE__*/ createValueClass(TEMPERATURE_UNITS, "temperature", {
    delta: () => TempDelta,
  }),
);
