import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineVocabulary } from "../locale/vocabulary";
import { Normalizer } from "../parse/normalize";
import { Tokenizer } from "../parse/tokenizer";
import { CUE_CEILING, collectCues } from "./cues";

/**
 * `BUILTIN_EN` with one kind's vocabulary replaced by a copy carrying cues.
 *
 * A patch and not an append: `composeLocale` refuses two vocabularies for one
 * (locale, kind), so appending a cue-only vocabulary for a kind the built-in
 * pack already covers throws before a single assertion runs. Spreading keeps
 * the original's units, which the mark still has to resolve through.
 */
const withCues = (kind: string, cues: Record<string, number>) =>
  BUILTIN_EN.map((v) => (v.kind === kind ? defineVocabulary({ ...v, cues }) : v));

/**
 * A duration and a length vocabulary patch, each carrying cues, composed on
 * top of the built-in English pack. Task 7 puts these words in the duration
 * package itself; this file declares its own so it tests the mechanism
 * rather than the shipped table.
 */
const patched = BUILTIN_EN.map((v) =>
  v.kind === "duration"
    ? defineVocabulary({ ...v, cues: { in: 3, time: 2, wait: 3 } })
    : v.kind === "length"
      ? defineVocabulary({ ...v, cues: { away: 4, from: 1 } })
      : v,
);

const locale = composeLocale(en, patched);
const registry = buildRegistry(BUILTIN_KINDS, [locale]);
const normalizer = new Normalizer();
const tokenizer = new Tokenizer({ locale, locales: [locale], registry });

/** Tokenize, then collect cues around the token range [from, to). */
function around(input: string, from: number, to: number, window = 4) {
  const normalized = normalizer.run(input);
  const stream = tokenizer.run(normalized);
  return collectCues({
    tokens: stream.tokens,
    from,
    to,
    input: normalized,
    registry,
    window,
  });
}

test("a keyword token is a cue candidate", () => {
  // The load-bearing half of §6.5. `in` is lexed as a `keyword` token, not a
  // `word` token, and carries no `text` field — a collector reading word
  // tokens only would find "time" and miss both "in"s, and the headline
  // example of this whole feature would resolve on one cue instead of three.
  //   word(Will) word(be) keyword(in) word(time) keyword(in) number(5) word(m)
  const { hits, weights } = around("Will be in time in 5m", 5, 7);
  expect(hits.map((h) => h.word)).toEqual(["in", "time", "in"]);
  // 3 + 2 + 3 = 8, clamped to the ceiling.
  expect(weights.duration).toBe(CUE_CEILING);
});

test("cue hit spans index the caller's string", () => {
  const input = "  wait 5 m  ";
  const { hits } = around(input, 1, 3);
  const hit = hits[0];
  expect(hit).toBeDefined();
  if (hit === undefined) return;
  expect(input.slice(hit.start, hit.end)).toBe("wait");
});

test("the window bounds how far a cue may reach", () => {
  // "wait" sits five tokens before the anchor, so a window of 4 cannot see it.
  const far = around("wait a b c d 5 m", 5, 7, 4);
  expect(far.hits).toEqual([]);
  const near = around("wait a b c d 5 m", 5, 7, 5);
  expect(near.hits.map((h) => h.word)).toEqual(["wait"]);
});

test("a sentence break stops the walk", () => {
  // §6.6: `lex` drops the full stop silently, so the break can only be seen in
  // the gap between two tokens' spans in the source.
  const { hits } = around("wait. 5 m", 1, 3);
  expect(hits).toEqual([]);
});

test("a decimal point is not a sentence break", () => {
  // "5.5" is one number token, so the dot never sits BETWEEN two tokens.
  const { hits } = around("wait 5.5 m", 1, 3);
  expect(hits.map((h) => h.word)).toEqual(["wait"]);
});

test("cues are collected on both sides of the mark", () => {
  const { weights } = around("in 5 m away", 1, 3);
  expect(weights.duration).toBe(3);
  expect(weights.length).toBe(4);
});

test("the ceiling clamps a negative sum too", () => {
  const negative = withCues("duration", { nope: -3 });
  const loc = composeLocale(en, negative);
  const reg = buildRegistry(BUILTIN_KINDS, [loc]);
  const tk = new Tokenizer({ locale: loc, locales: [loc], registry: reg });
  const normalized = normalizer.run("nope nope 5 m");
  const stream = tk.run(normalized);
  const { weights } = collectCues({
    tokens: stream.tokens,
    from: 2,
    to: 4,
    input: normalized,
    registry: reg,
    window: 4,
  });
  expect(weights.duration).toBe(-CUE_CEILING);
});
