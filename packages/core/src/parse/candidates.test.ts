import { expect, test } from "bun:test";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { identity, suffixStripper } from "../locale/helpers";
import { defineVocabulary } from "../locale/vocabulary";
import { createResolver } from "./candidates";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60 } },
});

const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  }),
  [
    defineVocabulary({
      locale: "en",
      kind: "length",
      units: { m: { aliases: ["m", "metre", "metres"] }, km: { aliases: ["km"] } },
    }),
    defineVocabulary({
      locale: "en",
      kind: "duration",
      units: { min: { aliases: ["min", "m", "minute"] } },
    }),
  ],
);
const registry = buildRegistry([number, length, duration], [en]);
const resolver = (layers: Parameters<typeof createResolver>[0]["layers"] = []) =>
  createResolver({ registry, locales: [en], format: en, layers });

test("an unambiguous alias yields one candidate", () => {
  expect(resolver().resolve("km")).toEqual([
    {
      kind: "length",
      unit: "km",
      locale: "en",
      weight: 0,
      surface: "km",
      foldedSurface: "km",
      form: "km",
      analyzerWeight: 0,
    },
  ]);
});

test("an ambiguous alias yields all candidates, deterministically ordered", () => {
  expect(
    resolver()
      .resolve("m")
      .map((c) => `${c.kind}:${c.unit}`),
  ).toEqual(["duration:min", "length:m"]);
});

test("weights reorder candidates", () => {
  const r = resolver([{ "length:m": 10 }]);
  expect(r.resolve("m").map((c) => `${c.kind}:${c.unit}`)).toEqual([
    "length:m",
    "duration:min",
  ]);
  expect(r.resolve("m")[0]?.weight).toBe(10);
});

test("an unknown surface yields no candidates", () => {
  expect(resolver().resolve("zzz")).toEqual([]);
});

test("nearest suggests close aliases for an unknown surface", () => {
  expect(resolver().nearest("kmm")).toContain("km");
});

test("nearest excludes exact matches, caps at three, and orders by distance", () => {
  const r = resolver();
  expect(r.nearest("km")).not.toContain("km");
  expect(r.nearest("m").length).toBeLessThanOrEqual(3);
  const near = r.nearest("kmm");
  expect(near[0]).toBe("km");
});

test("analyzed forms reach the vocabulary and are penalised", () => {
  const uk = composeLocale(
    defineLanguage({
      id: "uk",
      numberFormat: "intl",
      analyze: [identity(), suffixStripper({ suffixes: ["s"], minStem: 3, weight: -2 })],
      keywords: {},
      selectForm: () => "other",
    }),
  );
  const r = createResolver({ registry, locales: [uk], format: uk, layers: [] });
  const found = r.resolve("metres");
  expect(found.map((c) => `${c.kind}:${c.unit}`)).toEqual(["length:m"]);
  expect(found[0]?.weight).toBe(0);
});

test("a stem match scores below an exact match", () => {
  const uk = composeLocale(
    defineLanguage({
      id: "uk",
      numberFormat: "intl",
      analyze: [identity(), suffixStripper({ suffixes: ["e"], minStem: 3, weight: -2 })],
      keywords: {},
      selectForm: () => "other",
    }),
  );
  const r = createResolver({ registry, locales: [uk], format: uk, layers: [] });
  // "metre" matches exactly (weight 0); its stem "metr" matches nothing.
  expect(r.resolve("metre")[0]?.weight).toBe(0);
});

test("case is folded before lookup", () => {
  expect(
    resolver()
      .resolve("KM")
      .map((c) => c.unit),
  ).toEqual(["km"]);
});

test("the folded surface is kept alongside the surface as typed", () => {
  const [c] = resolver().resolve("KM");
  expect(c?.surface).toBe("KM");
  expect(c?.foldedSurface).toBe("km");
});

test("an analyzer weight adds to a prior and to layer weights, it does not replace them", () => {
  // The one combination that tells additive weighting apart from substitution:
  // a nonzero analyzer penalty on a candidate that also carries a prior and a
  // matching layer selector. Substitution would give -2, 7 or 3; only addition
  // gives 8.
  const priored = defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
    prior: 7,
  });
  const reg = buildRegistry(
    [number, priored],
    [
      composeLocale(en.language, [
        defineVocabulary({
          locale: "en",
          kind: "length",
          units: { m: { aliases: ["m", "metre"] }, km: { aliases: ["km"] } },
        }),
      ]),
    ],
  );
  const uk = composeLocale(
    defineLanguage({
      id: "uk",
      numberFormat: "intl",
      analyze: [identity(), suffixStripper({ suffixes: ["s"], minStem: 3, weight: -2 })],
      keywords: {},
      selectForm: () => "other",
    }),
  );
  const r = createResolver({
    registry: reg,
    locales: [uk],
    format: uk,
    layers: [{ length: 1 }, { "length:m": 2 }],
  });

  // "metres" only reaches the "metre" alias via the -2 stemmer.
  const [stemmed] = r.resolve("metres");
  expect(stemmed?.analyzerWeight).toBe(-2);
  expect(stemmed?.weight).toBe(7 + 1 + 2 - 2);

  // Same candidate reached exactly: identical layers, no analyzer penalty.
  const [exact] = r.resolve("metre");
  expect(exact?.analyzerWeight).toBe(0);
  expect(exact?.weight).toBe(7 + 1 + 2);
});

/**
 * A second language over the same kinds, with spellings English has never
 * heard of and a stemmer that strips the genitive plural the way the real
 * Ukrainian pack does. Everything below is about recognition being plural
 * while generation stays singular: the resolver is handed both languages and
 * one `format`, and the format never decides which readings exist.
 */
const ukrainian = composeLocale(
  defineLanguage({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), suffixStripper({ suffixes: ["ів"], minStem: 3, weight: -2 })],
    keywords: {},
    selectForm: () => "other",
  }),
  [
    defineVocabulary({
      locale: "uk",
      kind: "length",
      units: { m: { aliases: ["м", "метр"] }, km: { aliases: ["км"] } },
    }),
  ],
);
const bilingual = buildRegistry([number, length, duration], [en, ukrainian]);
const bothInstalled = (format = en) =>
  createResolver({ registry: bilingual, locales: [en, ukrainian], format, layers: [] });

test("each installed language contributes its own reading", () => {
  expect(
    bothInstalled()
      .resolve("км")
      .map((c) => c.locale),
  ).toEqual(["uk"]);
  expect(
    bothInstalled()
      .resolve("km")
      .map((c) => c.locale),
  ).toEqual(["en"]);
});

test("a language's analyzer chain runs only when that language is installed", () => {
  // "метрів" is an inflection no vocabulary lists: it reaches "метр" through
  // Ukrainian's stemmer or not at all. With only English installed there is no
  // chain that can produce the stem, and two deletions is past what the
  // correction pass will accept, so the surface is simply unknown.
  const enOnly = createResolver({
    registry: bilingual,
    locales: [en],
    format: en,
    layers: [],
  });
  expect(enOnly.resolve("метрів")).toEqual([]);

  // Installing Ukrainian is the whole difference, and the reading it produces
  // is a stem match — weight -2, no `fuzzy` — not an English word misspelled.
  const [reading] = bothInstalled().resolve("метрів");
  expect(reading?.unit).toBe("m");
  expect(reading?.locale).toBe("uk");
  expect(reading?.form).toBe("метр");
  expect(reading?.analyzerWeight).toBe(-2);
  expect(reading?.fuzzy).toBeUndefined();
});

test("a corrected candidate carries the locale of the entry it corrected to", () => {
  const [corrected] = bothInstalled().resolve("метрр");
  expect(corrected?.locale).toBe("uk");
  expect(corrected?.fuzzy?.alias).toBe("метр");
});

test("a literal is attributed to the format locale", () => {
  const attributed = (format: Parameters<typeof createResolver>[0]["format"]) =>
    bothInstalled(format).literal({ kind: "length", unit: "m", surface: "3m", weight: 0 })
      .locale;
  expect(attributed(en)).toBe("en");
  expect(attributed(ukrainian)).toBe("uk");
});

test("one surface read by two languages as one unit is two candidates, not one", () => {
  // The property Task 16's `locale:` selector rests on, and the one a
  // kind:unit dedupe key destroys silently: both languages reach `length:m`
  // from "metres", through different aliases their own stemmers found. If the
  // key ignored locale the lower-weighted reading would be dropped here, long
  // before any weight could prefer it.
  const enStems = composeLocale(
    defineLanguage({
      id: "en",
      numberFormat: "intl",
      analyze: [identity(), suffixStripper({ suffixes: ["s"], minStem: 3, weight: -2 })],
      keywords: {},
      selectForm: () => "other",
    }),
    [
      defineVocabulary({
        locale: "en",
        kind: "length",
        units: { m: { aliases: ["metre"] } },
      }),
    ],
  );
  const ukStems = composeLocale(
    defineLanguage({
      id: "uk",
      numberFormat: "intl",
      analyze: [identity(), suffixStripper({ suffixes: ["es"], minStem: 3, weight: -3 })],
      keywords: {},
      selectForm: () => "other",
    }),
    [
      defineVocabulary({
        locale: "uk",
        kind: "length",
        units: { m: { aliases: ["metr"] } },
      }),
    ],
  );
  const shared = buildRegistry([number, length], [enStems, ukStems]);
  const r = createResolver({
    registry: shared,
    locales: [enStems, ukStems],
    format: enStems,
    layers: [],
  });

  const readings = r.resolve("metres");
  // Stated the other way round, because this is what a kind:unit key would
  // see: the two readings are indistinguishable except by locale.
  expect(new Set(readings.map((c) => `${c.kind}:${c.unit}`)).size).toBe(1);
  expect(readings.map((c) => `${c.kind}:${c.unit}:${c.locale}`)).toEqual([
    "length:m:en",
    "length:m:uk",
  ]);
  expect(readings.map((c) => c.form)).toEqual(["metre", "metr"]);
  expect(readings.map((c) => c.weight)).toEqual([-2, -3]);
});
