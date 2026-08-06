import { expect, test } from "bun:test";
import * as api from "./index";

test("the public surface is what the package promises", () => {
  // No `ZONES` and no `OFFSET_ZONES`: the zone tables live in
  // `@smartput/timezone`, so a form field that needs zone names can have them
  // without chrono and Temporal coming along.
  expect(Object.keys(api).sort()).toEqual([
    "DATETIME_KIND",
    "Temporal",
    "datetime",
    "parseDateTime",
    "unwrap",
    "wrap",
  ]);
});
