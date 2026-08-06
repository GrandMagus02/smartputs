import { describe, expect, test } from "bun:test";
import { OFFSET_ZONES, offsetZoneId, parseOffsetZone } from "./offset";

const parse = (text: string) => parseOffsetZone(text);

describe("parseOffsetZone", () => {
  test("reads the bare hour form", () => {
    expect(parse("gmt+3")).toEqual({ zone: "+03:00", length: 5 });
    expect(parse("GMT+3")).toEqual({ zone: "+03:00", length: 5 });
    expect(parse("utc-5")).toEqual({ zone: "-05:00", length: 5 });
    expect(parse("UTC+14")).toEqual({ zone: "+14:00", length: 6 });
  });

  test("reads the colon and compact minute forms", () => {
    expect(parse("gmt+5:30")).toEqual({ zone: "+05:30", length: 8 });
    expect(parse("utc+0530")).toEqual({ zone: "+05:30", length: 8 });
    expect(parse("gmt+05:45")).toEqual({ zone: "+05:45", length: 9 });
    expect(parse("utc-03:00")).toEqual({ zone: "-03:00", length: 9 });
  });

  test("tolerates the spaces a person types", () => {
    expect(parse("gmt + 3")).toEqual({ zone: "+03:00", length: 7 });
  });

  test("claims only the offset, not what follows it", () => {
    expect(parse("gmt+3 meeting")).toEqual({ zone: "+03:00", length: 5 });
  });

  test("zero is UTC, spelled as an offset", () => {
    expect(parse("gmt+0")).toEqual({ zone: "+00:00", length: 5 });
  });

  test("refuses what is not an offset zone", () => {
    // No sign: "gmt" alone is the UTC alias the kind already registers.
    expect(parse("gmt")).toBeNull();
    expect(parse("est+3")).toBeNull();
    expect(parse("3pm")).toBeNull();
    // Outside the range real zones occupy.
    expect(parse("gmt+15")).toBeNull();
    expect(parse("gmt-13")).toBeNull();
    // Not a quarter-hour, so not a zone anyone keeps time in.
    expect(parse("gmt+3:20")).toBeNull();
    // A letter straight after the digits means the run was something else.
    expect(parse("gmt+3x")).toBeNull();
  });
});

describe("offsetZoneId", () => {
  test("pads both halves and always carries a sign", () => {
    expect(offsetZoneId(0)).toBe("+00:00");
    expect(offsetZoneId(180)).toBe("+03:00");
    expect(offsetZoneId(-330)).toBe("-05:30");
    expect(offsetZoneId(840)).toBe("+14:00");
  });
});

describe("OFFSET_ZONES", () => {
  test("covers every quarter hour from -12:00 to +14:00", () => {
    expect(Object.keys(OFFSET_ZONES)).toHaveLength((14 + 12) * 4 + 1);
    expect(OFFSET_ZONES["+03:00"]?.symbol).toBe("UTC+03:00");
    expect(OFFSET_ZONES["-05:30"]?.symbol).toBe("UTC-05:30");
  });

  test("registers no aliases, because an offset is never one word", () => {
    // "gmt+3" lexes as three tokens, so it can only be reached by the literal
    // matcher. An alias index entry for it would never be looked up.
    for (const def of Object.values(OFFSET_ZONES)) expect(def.aliases).toEqual([]);
  });

  test("zero formats as UTC rather than as an offset", () => {
    expect(OFFSET_ZONES["+00:00"]?.symbol).toBe("UTC");
  });
});
