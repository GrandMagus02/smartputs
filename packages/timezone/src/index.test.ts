import { expect, test } from "bun:test";
import * as api from "./index";

test("the public surface is what the package promises", () => {
  expect(Object.keys(api).sort()).toEqual([
    "OFFSET_ZONES",
    "ZONES",
    "offsetZoneId",
    "parseOffsetZone",
    "zoneSymbol",
  ]);
});
