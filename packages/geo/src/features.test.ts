import { expect, test } from "bun:test";
import {
  featureClasses,
  GEO_KINDS,
  kindOf,
  wantsPostal,
  wantsToponyms,
} from "./features";

test("class A is split by feature code, which is the only thing that tells them apart", () => {
  expect(kindOf("A", "PCLI")).toBe("country");
  expect(kindOf("A", "TERR")).toBe("country");
  expect(kindOf("A", "ADM1")).toBe("admin");
  expect(kindOf("A", "ADM4")).toBe("admin");
});

test("PCLH is a country that no longer exists and is not offered as one", () => {
  // The reason `COUNTRY_CODES` is a list rather than a `startsWith("PCL")`:
  // the USSR and Yugoslavia are class A, code PCLH, and a picker offering them
  // as countries is wrong in a way a prefix test cannot see.
  expect(kindOf("A", "PCLH")).toBe("admin");
});

test("every other class maps to exactly one kind", () => {
  expect(kindOf("P", "PPL")).toBe("city");
  expect(kindOf("H", "STM")).toBe("water");
  expect(kindOf("T", "MT")).toBe("terrain");
  expect(kindOf("L", "PRK")).toBe("area");
  expect(kindOf("R", "RD")).toBe("road");
  expect(kindOf("S", "AIRP")).toBe("spot");
  expect(kindOf("U", "SMU")).toBe("undersea");
  expect(kindOf("V", "FRST")).toBe("vegetation");
});

test("an unknown class is labelled, not discarded", () => {
  // A row that reached `kindOf` is a real toponym with a real name. Refusing to
  // label it would drop it from a result set it belongs in, and GeoNames has
  // added no class letter in twenty years.
  expect(kindOf("Z", "???")).toBe("spot");
  expect(kindOf("", "")).toBe("spot");
});

test("country and admin collapse to one featureClass, because upstream has one", () => {
  expect(featureClasses(["country", "admin"])).toEqual(["A"]);
  expect(featureClasses(["city", "water"])).toEqual(["P", "H"]);
});

test("postal contributes no class, since it is a different index entirely", () => {
  expect(featureClasses(["postal"])).toEqual([]);
});

test("no kinds means no filter, which is what upstream does with no parameter", () => {
  expect(featureClasses(undefined)).toEqual([]);
  expect(featureClasses([])).toEqual([]);
  expect(wantsPostal(undefined)).toBe(true);
  expect(wantsToponyms(undefined)).toBe(true);
});

test("the two routing predicates disagree exactly where the indexes do", () => {
  expect(wantsPostal(["postal"])).toBe(true);
  expect(wantsToponyms(["postal"])).toBe(false);
  expect(wantsPostal(["city"])).toBe(false);
  expect(wantsToponyms(["city"])).toBe(true);
});

test("GEO_KINDS lists every kind the mapping knows", () => {
  expect(GEO_KINDS).toHaveLength(11);
  // Round-trip: each non-postal kind names a class, and that class labels back.
  for (const kind of GEO_KINDS) {
    if (kind === "postal") continue;
    expect(featureClasses([kind])).toHaveLength(1);
  }
});
