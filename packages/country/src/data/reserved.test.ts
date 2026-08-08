import { expect, test } from "bun:test";
import lengthEn from "@smartput/length/locale/en";
import { NUMBER_WORDS } from "@smartput/number";
import { COUNTRIES } from "./countries";
import { RESERVED_WORDS } from "./reserved";

/** Duplicated from the generator for the reason `countries.test.ts` gives. */
const BODY_MARKER = "// ---- generated body; the hash above covers everything below ----";

const source = await Bun.file(new URL("./reserved.ts", import.meta.url)).text();

test("the committed body still hashes to what the header claims", () => {
  const claimed = /^\/\/ sha256 body\s+([0-9a-f]{64})$/m.exec(source)?.[1];
  const at = source.indexOf(BODY_MARKER);
  expect(at).toBeGreaterThan(0);
  const body = source.slice(at + BODY_MARKER.length);
  const actual = new Bun.CryptoHasher("sha256").update(body).digest("hex");
  // A mismatch means the set was hand-edited — which is the one thing it must
  // not be, because a word added by hand is a word no source will keep alive.
  expect(actual).toBe(claimed as string);
});

/**
 * The words that would do the damage, one line per reason.
 *
 * This is the test the derivation is written to pass, and the instruction that
 * comes with it is: a word missing here means a *source* is missing, not that
 * this word should be appended. The set exists because a hand-maintained list
 * fails on the entry nobody thought of, and appending to it is how it becomes
 * one.
 */
const MUST_REFUSE: ReadonlyArray<readonly [word: string, breaks: string]> = [
  ["and", "two hundred and five"],
  ["ago", "3 days ago"],
  ["of", "half of 200"],
  ["to", "japan to ukraine"],
  ["as", "10 m as ft"],
  ["may", "may 3"],
  ["march", "march 3 2026"],
  ["one", "one hundred"],
  ["hundred", "one hundred"],
  ["million", "3 million"],
  ["no", "the alpha-2 of Norway, which M6.1 refuses to claim"],
  ["is", "the alpha-2 of Iceland"],
  ["it", "the alpha-2 of Italy"],
  ["today", "today + 3 days"],
  ["now", "now in tokyo"],
  ["in", "3pm in japan"],
  ["over", "10 over 2"],
  ["by", "10 divided by 2"],
  ["times", "3 times 4"],
  ["km", "10 km"],
  ["mile", "10 mile"],
];

test("every word that would destroy an expression is refused", () => {
  const missing = MUST_REFUSE.filter(([word]) => !RESERVED_WORDS.has(word));
  expect(missing.map(([word, breaks]) => `${word} (${breaks})`)).toEqual([]);
});

test("the set is a derivation, not a list somebody wrote", () => {
  // A hand list of the words a person thinks of is a hundred entries at most.
  // The floor is here so the day a source stops producing — an import that
  // resolves to an empty module, a vocabulary that moves — is a failure and not
  // a table that quietly gets shorter.
  expect(RESERVED_WORDS.size).toBeGreaterThan(500);
});

test("every entry is a single lowercase word", () => {
  // The matcher tests one lowercased word at a time, so an entry with a space, a
  // digit or a capital is an entry nothing can ever match — dead weight that
  // reads like coverage.
  for (const word of RESERVED_WORDS) expect(word).toMatch(/^[a-z][a-z']*$/);
});

test("the number package's whole vocabulary is in it", () => {
  // Not a spot check: this is what proves the words were read out of the
  // package rather than copied. `NUMBER_WORDS` gained "hundred" in a commit of
  // its own, and a transcription would still be missing it.
  for (const word of NUMBER_WORDS) expect(RESERVED_WORDS.has(word)).toBe(true);
});

test("every alias and written form of a built-in kind is in it", () => {
  // `length` stands for all twelve: geo dev-depends on it, and every unit alias
  // reaches the reserved set by the same route. "10 km" and "10 miles" are the
  // readings a city called Km or Miles would have taken. The words are read
  // from the kind's English vocabulary, which is where they moved when the
  // descriptor stopped carrying a `lexicon`.
  for (const [unit, entry] of Object.entries(lengthEn.units)) {
    const words = [
      ...entry.aliases,
      entry.symbol ?? "",
      ...Object.values(entry.forms ?? {}),
    ];
    for (const word of [unit, ...words]) {
      if (!/^[a-z][a-z']*$/.test(word)) continue;
      expect(RESERVED_WORDS.has(word)).toBe(true);
    }
  }
});

test("no country keeps a name the set would have taken", () => {
  // The set is applied to CITIES and ADMIN1 and never to COUNTRIES, but if the
  // two ever overlapped the ruling would be a choice rather than a free one.
  // They do not: no country's name is a word the engine owns, so the separation
  // costs nothing today and this test says so if that stops being true.
  const clashes: string[] = [];
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      // Below four characters every alias here is an ISO code, and the codes are
      // exactly what `shortPlaceCodes` puts *into* the set on purpose.
      if (alias.length < 4 || alias.includes(" ")) continue;
      if (RESERVED_WORDS.has(alias)) clashes.push(`${country.a2}: ${alias}`);
    }
  }
  expect(clashes).toEqual([]);
});

test("the hand-written supplement stays a remainder", () => {
  // The generator prunes any supplement word a source already produces, so what
  // survives is only what no derivation reaches. If this block ever grows, the
  // fix is a source — the block is not where the vocabulary lives.
  const at = source.indexOf("// ---- hand-written:");
  const block = at < 0 ? "" : source.slice(at);
  expect((block.match(/^ {2}"/gm) ?? []).length).toBeLessThanOrEqual(3);
});
