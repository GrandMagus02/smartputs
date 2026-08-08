import { expect, test } from "bun:test";
import { Angle } from "@smartput/angle/class";
import type { QuantitySnapshot } from "@smartput/core";
import { composeLocale, createFacades } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { Length } from "@smartput/length/class";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

const en = composeLocale(english, BUILTIN_EN);

const facades = createFacades({ kinds: BUILTIN_KINDS, locale: en });

const Quantity = facades.angle as NonNullable<(typeof facades)["angle"]>;
const LengthQuantity = facades.length as NonNullable<(typeof facades)["length"]>;

/**
 * Spec §11: the two class families interoperate in both directions. This is the
 * direction that forced the only public-type change in the spec — a
 * `ValueInstance` carries `value: number`, and `QuantitySnapshot.value` was
 * `string`, so `Quantity.from(angle)` did not typecheck at all.
 *
 * These are compile-time assertions as much as runtime ones: if the widening is
 * reverted, `bun run typecheck` fails here before any expectation runs.
 */
test("Quantity.from accepts a micro-path instance directly", () => {
  const angle = Angle.parse("30deg");
  const q = Quantity.from(angle);

  expect(q.unit).toBe("deg");
  expect(q.value.toString()).toBe("30");
});

test("a ValueInstance satisfies QuantitySnapshot structurally", () => {
  // The assignment is the test; it is what `from`'s snapshot branch relies on.
  const snapshot: QuantitySnapshot = Angle.parse("1.5rad");
  expect(snapshot.unit).toBe("rad");
  expect(snapshot.value).toBe(1.5);
});

test("the widening does not break the string snapshots toJSON emits", () => {
  const q = Quantity.from(Angle.parse("30deg"));
  const json = q.toJSON();
  // toJSON still narrows to a decimal string, so a round-trip through JSON is
  // unchanged by the widening.
  expect(typeof json.value).toBe("string");
  expect(Quantity.from(JSON.parse(JSON.stringify(json))).value.toString()).toBe("30");
});

test("a numeric snapshot round-trips through from() with full precision", () => {
  // `value: number` is the whole point of the widening; check it is read as a
  // number and not stringified through some lossy path.
  const q = LengthQuantity.from({ value: 0.1, unit: "m" });
  expect(q.value.toString()).toBe("0.1");
});

test("the reverse crossing goes through a compact string, not a snapshot", () => {
  const q = Quantity.from(Angle.parse("30deg"));
  // `ValueClass.from` takes `Input<U> = string | Ok<U>`, not a `{value, unit}`
  // snapshot, so the Quantity → Angle direction is spelled with the compact
  // form `parse` already round-trips. Spec §11's `Angle.from(quantity)` line
  // overstates the current factory surface; widening it is a class-factory
  // change, not a `QuantitySnapshot` one, so it is left alone here.
  const back = Angle.from(`${q.value.toFixed()}${q.unit}`);
  expect(back.value).toBe(30);
  expect(back.unit).toBe("deg");
});

test("cross-family conversion agrees on magnitude", () => {
  const micro = Length.parse("2.5km");
  const q = LengthQuantity.from(micro);
  expect(q.to("m").toString()).toBe("2500");
  expect(micro.to("m")).toBe(2500);
});
