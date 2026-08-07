import { expect, test } from "bun:test";
import { CITIES } from "@smartput/city";
import {
  type CompleteCtx,
  composeLocale,
  createEngine,
  Decimal,
  type Kind,
} from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import {
  completePlaces,
  createPlaceIndex,
  DEFAULT_LIMIT,
  PlaceCompleter,
} from "./completion";
import { COUNTRIES } from "./data/countries";
import { MIN_NAME_LENGTH } from "./matcher";
import { definePlace } from "./place";

/**
 * The two builds spec §3 tiers, side by side in every test that has an opinion
 * about which one a name comes from. Built once: the index behind them is a
 * pure function of the tables, so a per-test instance would rebuild 6,247
 * cities to ask one question.
 */
const countryOnly = new PlaceCompleter(COUNTRIES);
const withCities = new PlaceCompleter(COUNTRIES, CITIES);

/**
 * A fragment standing alone, which is the shape every test below asks about.
 * `input` and `span` say "nothing in front of it", so the look-back over
 * preceding words finds nothing to reach for — `ctxAfter` is for that.
 */
const ctx = (fragment: string, count?: number): CompleteCtx => ({
  locale: "en",
  fragment,
  input: fragment,
  span: { start: 0, end: fragment.length },
  ...(count === undefined ? {} : { count: new Decimal(count) }),
});

/** The same, with `before` already typed in front of the fragment. */
const ctxAfter = (before: string, fragment: string): CompleteCtx => ({
  locale: "en",
  fragment,
  input: `${before} ${fragment}`,
  span: { start: before.length + 1, end: before.length + 1 + fragment.length },
});

const rows = (c: PlaceCompleter, fragment: string) => c.completions(ctx(fragment));
const texts = (c: PlaceCompleter, fragment: string) =>
  rows(c, fragment).map((r) => r.text);

/** Every fragment a keystroke can begin with, which is where the cost lives. */
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const PAIRS = LETTERS.flatMap((a) => LETTERS.map((b) => a + b));

test("a country completes from the countries-only build", () => {
  const [first] = rows(countryOnly, "ukrai");
  expect(first?.text).toBe("Ukraine");
  expect(first?.alias).toBe("ukraine");
  expect(first?.unit).toBe("ua");
});

test("definePlace() with no cities completes no city at all", () => {
  for (const fragment of ["kyi", "chicag", "springfield", "tokyo", "leningrad"]) {
    expect(rows(countryOnly, fragment)).toEqual([]);
  }

  // The sweep, because five fragments prove five fragments. Every row the T0
  // build can emit names a country of the table it was given.
  const ids = new Set(COUNTRIES.map((c) => String(c.geonameId)));
  for (const fragment of PAIRS) {
    for (const row of rows(countryOnly, fragment))
      expect(ids.has(row.key ?? "")).toBe(true);
  }
});

test("a city completes once the tier is on", () => {
  expect(texts(withCities, "kyi")[0]).toBe("Kyiv");
  expect(texts(withCities, "chicag")).toEqual(["Chicago"]);
});

test("the text is the place's display name, not the alias typed a prefix of", () => {
  const [kiev] = rows(withCities, "kiev");
  expect(kiev?.alias).toBe("kiev");
  expect(kiev?.text).toBe("Kyiv");

  // The historical name reaches the modern one, which is the whole reason the
  // two fields are separate.
  const [leningrad] = rows(withCities, "leningrad");
  expect(leningrad?.alias).toBe("leningrad");
  expect(leningrad?.text).toBe("Saint Petersburg");
});

test("a country outranks a city, and a capital outranks a bigger namesake", () => {
  // §6.1's +3 against a cap of +2. "george" is South Africa's, 188,580 people.
  expect(texts(withCities, "geor")[0]).toBe("Georgia");
  expect(rows(withCities, "geor")[0]?.unit).toBe("ge");

  // Both aliases are "athens", so the length term cancels and §6.1's capital row
  // is the whole of the ranking: 664,046 in Greece over 127,315 in Georgia, US.
  const athens = rows(withCities, "athens");
  expect(athens.map((r) => r.unit)).toEqual(["gr", "us"]);
  expect(athens.map((r) => r.key)).toEqual(["264371", "4180386"]);
});

test("a shorter alias wins at equal weight, so paris beats paris-something", () => {
  const paris = rows(withCities, "paris");
  expect(paris[0]?.text).toBe("Paris");
  expect(paris[0]?.key).toBe("2988507");
  // The arrondissements are longer, so they queue behind it.
  expect(paris.slice(1).every((r) => r.text.startsWith("Paris "))).toBe(true);

  // "unit" is the case that isolates the length term: eight countries, all on
  // the same flat country weight, so nothing but the alias still to be typed can
  // separate them. Alphabetical would lead with the Emirates. Asked of a
  // completer wide enough to hold all eight, because the assertion is about
  // their order and the shipped cap is three.
  const eight = withCities.withLimit(8);
  expect(texts(eight, "unit")).toEqual([
    "United States",
    "United Kingdom",
    "United Arab Emirates",
    "Egypt",
    "Mexico",
    "Brazil",
    "Indonesia",
    "Venezuela",
  ]);
  // The two longest are the same length, where the alias breaks the tie.
  expect(
    rows(eight, "unit")
      .slice(6)
      .map((r) => r.alias),
  ).toEqual(["united states of indonesia", "united states of venezuela"]);
});

test("the alias the user finished typing outranks a heavier one still unfinished", () => {
  // Beni, DR Congo scores -1.28 - 4 = -5.28 on the prefix, Benin the country
  // 0 - 5 = -5.00, so on weight alone the country leads. `complete()` adds
  // EXACT_BONUS to a row whose alias the user has finished, and this file has to
  // rank the same way or the row core would put first is the row it never sees.
  expect(texts(withCities, "beni").slice(0, 2)).toEqual(["Beni", "Benin"]);
});

test("every reading of one name is a row of its own", () => {
  const springfields = rows(withCities, "springfield");
  // Three places, one alias, one unit: the de-duplication key is the only thing
  // keeping them apart in core's map, and §6.1 orders them by population.
  expect(springfields.map((r) => r.text)).toEqual([
    "Springfield",
    "Springfield",
    "Springfield",
  ]);
  expect(springfields.map((r) => r.unit)).toEqual(["us", "us", "us"]);
  expect(springfields.map((r) => r.key)).toEqual(["4409896", "4951788", "4250542"]);
});

test("two names for one place are one row", () => {
  // "kenia" and "kenya" both stand under "k"; "georgia" and "georgian soviet
  // socialist republic" both under "geor".
  const keys = rows(withCities, "k").map((r) => r.key);
  expect(new Set(keys).size).toBe(keys.length);
  expect(texts(withCities, "geor").filter((t) => t === "Georgia")).toEqual(["Georgia"]);

  for (const fragment of PAIRS) {
    const seen = rows(withCities, fragment).map((r) => r.key);
    expect(new Set(seen).size).toBe(seen.length);
  }
});

test("nothing shorter than MIN_NAME_LENGTH is ever offered", () => {
  // The hazard the completer path reintroduces: it never touches the global
  // alias index, so the floor that index applies is not applied for it. "km" is
  // Comoros, and an offered Comoros outranks a kilometre.
  expect(rows(withCities, "km")).toEqual([]);
  // The floor is on the alias, not on the fragment: "in" completes India, which
  // is a name, and never India's own code, which is a token an inch owns.
  expect(rows(withCities, "in").map((r) => r.alias)).not.toContain("in");
  expect(texts(withCities, "in")).toContain("India");

  for (const fragment of PAIRS) {
    for (const row of rows(withCities, fragment)) {
      expect(row.alias.length).toBeGreaterThanOrEqual(MIN_NAME_LENGTH);
    }
  }
});

test("a count in front of the fragment means a quantity, and a place is not one", () => {
  expect(withCities.completions(ctx("kyi", 10))).toEqual([]);
  expect(withCities.completions(ctx("kyi"))).not.toEqual([]);
});

test("every row names a unit the kind registered", () => {
  const units = new Set(COUNTRIES.map((c) => c.a2));
  for (const fragment of PAIRS) {
    for (const row of rows(withCities, fragment)) expect(units.has(row.unit)).toBe(true);
  }
});

test("a multi-word name completes, through core as well as here", () => {
  // The trie is keyed on characters and an alias keeps its spaces, so a fragment
  // that spans two words is an ordinary descent and needs nothing added.
  expect(texts(withCities, "san fran")[0]).toBe("San Francisco");
  expect(texts(withCities, "new yor")[0]).toBe("New York City");

  // Reaching it through core took a seam. `trailingFragment` is one word, so
  // `complete("san fran")` used to ask this file about "fran" alone and splice
  // the answer back over "fran" alone — which returned "san France", a place
  // that does not exist. `CompleteCtx` now carries the whole input and the
  // fragment's span, and a row may name the offset it replaces from.
  const engine = createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [...BUILTIN_KINDS, { ...definePlace({ cities: CITIES }) }],
  });
  const first = engine.complete("san fran")[0];
  expect(first?.text).toBe("San Francisco");
  // The whole of what was typed, not just the last word of it.
  expect(first?.span).toEqual({ start: 0, end: 8 });
});

test("a name is completed under a preceding word only when it belongs to it", () => {
  // "san" is part of the name, so the look-back claims it.
  expect(withCities.completions(ctxAfter("san", "fran"))[0]?.text).toBe("San Francisco");
  // "10 km +" is not. Nothing in front is part of any name, so the fragment
  // stands alone and the row replaces only itself.
  const alone = withCities.completions(ctxAfter("10 km +", "kyi"))[0];
  expect(alone?.text).toBe("Kyiv");
  expect(alone?.start).toBe("10 km + ".length);
});

test("a look-back row is scored against the whole of what was typed", () => {
  // Jakarta's GeoNames aliases really do include "new york van java", and it is
  // a capital, so on weight alone it ties New York City. The tiebreak is how
  // much of the alias is still untyped — and core measured that against the
  // fragment, "yor", which neither alias begins with. Both scored zero, the tie
  // fell through to the country code, and "id" sorts above "us".
  const engine = createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [...BUILTIN_KINDS, definePlace({ cities: CITIES })],
  });
  expect(engine.complete("new yor").map((r) => r.text)).toEqual([
    "New York City",
    "Jakarta",
  ]);
});

test("an unknown prefix is nothing, not everything", () => {
  expect(rows(withCities, "zzzq")).toEqual([]);
  expect(rows(withCities, "")).toEqual([]);
});

test("the limit is the row cap, and withLimit returns a new completer", () => {
  expect(rows(withCities, "s").length).toBe(DEFAULT_LIMIT);

  const two = withCities.withLimit(2);
  expect(two).not.toBe(withCities);
  expect(two.limit).toBe(2);
  expect(two.completions(ctx("s")).length).toBe(2);
  // The first two of the three, not a different two.
  expect(two.completions(ctx("s"))).toEqual(rows(withCities, "s").slice(0, 2));
  expect(withCities.limit).toBe(DEFAULT_LIMIT);

  // And upwards, which is the direction a place picker asks in — the shipped cap
  // is sized for a list it shares with every other kind, not for a list of
  // places, and widening it must extend the ranking rather than redo it.
  const twenty = withCities.withLimit(20);
  expect(twenty.completions(ctx("s")).length).toBe(20);
  expect(rows(withCities, "s")).toEqual(
    twenty.completions(ctx("s")).slice(0, DEFAULT_LIMIT),
  );

  expect(withCities.withLimit(0).completions(ctx("s"))).toEqual([]);
});

test("an instance is frozen", () => {
  expect(Object.isFrozen(withCities)).toBe(true);
  expect(() => {
    (withCities as { limit: number }).limit = 3;
  }).toThrow();
});

test("the class is the door and the function is what is behind it", () => {
  const index = createPlaceIndex(COUNTRIES, CITIES);
  for (const fragment of ["kyi", "athens", "paris", "s", "zzzq"]) {
    expect(completePlaces(index, ctx(fragment), DEFAULT_LIMIT)).toEqual(
      rows(withCities, fragment),
    );
  }
});

test("a prefix walk, not a scan: the worst fragment stays inside one keystroke", () => {
  // The control, on this machine, in this run. A completer is called once per
  // keystroke for every kind, so the number that matters is not how long the
  // walk takes but how it compares with reading every alias — 8,227 of them,
  // which is what any structure that is not a prefix tree has to do.
  const aliases: { alias: string; weight: number }[] = [];
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      if (alias.length >= MIN_NAME_LENGTH) aliases.push({ alias, weight: 3 });
    }
  }
  for (const city of CITIES) {
    for (const alias of city.aliases)
      aliases.push({ alias, weight: city.capital ? 2 : 1 });
  }
  const scan = (fragment: string) =>
    aliases
      .filter((a) => a.alias.startsWith(fragment))
      .sort((a, b) => b.weight - b.alias.length - (a.weight - a.alias.length))
      .slice(0, DEFAULT_LIMIT);

  // The fragments a launcher actually sits on: one and two characters, where
  // the subtree is largest and the answer is least decided.
  const worst = ["a", "b", "s", "k", "m", "c", "sa", "san", "new", "par", "kyi", "z"];
  const time = (f: (fragment: string) => unknown, runs: number): number => {
    for (let i = 0; i < 20; i += 1) for (const w of worst) f(w);
    let best = Number.POSITIVE_INFINITY;
    for (let round = 0; round < 5; round += 1) {
      const started = Bun.nanoseconds();
      for (let i = 0; i < runs; i += 1) for (const w of worst) f(w);
      best = Math.min(best, (Bun.nanoseconds() - started) / (runs * worst.length) / 1000);
    }
    return best;
  };

  const walk = time((fragment) => rows(withCities, fragment), 200);
  const linear = time(scan, 20);

  // Measured at 1.5 µs against the scan's 142 µs. The absolute bound is what a
  // keystroke can afford beside core's own ~20 µs; the ratio is what says the
  // cost did not merely move to a faster machine.
  expect(walk).toBeLessThan(50);
  expect(walk).toBeLessThan(linear / 10);
});

test("the call site: the kind registers the completer and core ranks the rows", () => {
  // What `place.ts` will read, spelled out here because that file is another
  // agent's this phase:
  //
  //     completions: new PlaceCompleter(COUNTRIES, opts.cities).completions,
  const kind: Kind = {
    ...definePlace({ cities: CITIES }),
    completions: withCities.completions,
  };
  const engine = createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [...BUILTIN_KINDS, kind],
  });

  const kyiv = engine.complete("3pm in kyi");
  expect(kyiv[0]?.text).toBe("3pm in Kyiv");
  expect(kyiv[0]?.kind).toBe("place");
  expect(kyiv[0]?.unit).toBe("ua");

  // The kind is opaque, so the global alias index completes none of this: a
  // country reaches the list through the same door a city does.
  expect(engine.complete("ukrai")[0]?.text).toBe("Ukraine");

  // And the ratio path is untouched where a count says the fragment is a unit.
  expect(engine.complete("10 k").every((c) => c.kind !== "place")).toBe(true);
});
