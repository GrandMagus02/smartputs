import type { Candidate, ChatVocabulary, Hole } from "./types";

/** Phrases are matched against a case-folded copy; spans index the original. */
const fold = (s: string) => s.toLowerCase();

/** Trailing punctuation a stripped head may carry — "hi," and "hey!". */
const HEAD_PUNCT = /^[,!.:;\s]+/;

/** Characters that may sit either side of a matched phrase. */
const BOUND = /[\s,!.:;]/;

/**
 * The longest listed phrase `text` starts with, ending at a word boundary.
 *
 * Longest-first because "what is" must beat "what": a shorter prefix winning
 * would leave "is" at the head of the payload, and `engine.suggest` would
 * reject the span that was otherwise correct.
 */
function matchAtHead(text: string, phrases: readonly string[]): string | undefined {
  const folded = fold(text);
  let best: string | undefined;
  for (const phrase of phrases) {
    if (!folded.startsWith(phrase)) continue;
    const after = folded.charAt(phrase.length);
    if (after !== "" && !BOUND.test(after)) continue;
    if (best === undefined || phrase.length > best.length) best = phrase;
  }
  return best;
}

/** Same, at the tail. */
function matchAtTail(text: string, phrases: readonly string[]): string | undefined {
  const folded = fold(text);
  let best: string | undefined;
  for (const phrase of phrases) {
    if (!folded.endsWith(phrase)) continue;
    const before = folded.charAt(folded.length - phrase.length - 1);
    if (before !== "" && !BOUND.test(before)) continue;
    if (best === undefined || phrase.length > best.length) best = phrase;
  }
  return best;
}

/** Which frame, if any, the span opens with. */
function frameOf(text: string, vocabs: readonly ChatVocabulary[]): string | undefined {
  for (const vocab of vocabs) {
    for (const [frame, spellings] of Object.entries(vocab.frames)) {
      if (matchAtHead(text, spellings) !== undefined) return frame;
    }
  }
  return undefined;
}

/**
 * Referents are RECOGNISED and never removed.
 *
 * Stripping "this" out of "convert this to kg" would leave "convert to kg",
 * which reads as a complete instruction and is not one. The word is the
 * evidence that a slot is empty, so it stays in the text and the emptiness
 * becomes a `Hole` beside it.
 */
function holesOf(text: string, vocabs: readonly ChatVocabulary[]): Hole[] {
  const folded = fold(text);
  for (const vocab of vocabs) {
    for (const ref of vocab.referents) {
      const at = folded.indexOf(ref);
      if (at < 0) continue;
      const before = folded.charAt(at - 1);
      const after = folded.charAt(at + ref.length);
      const ok = (c: string) => c === "" || BOUND.test(c);
      if (!ok(before) || !ok(after)) continue;
      // The kind is left open here and narrowed by the target unit at fill
      // time: "to kg" is what says this hole is a mass, and that word has not
      // been read yet. `""` means "any kind"; `fill` replaces it.
      return [{ slot: "source", kind: "" }];
    }
  }
  return [];
}

/**
 * Strip the carrier phrase and emit every span the message could have meant.
 *
 * Head-only and tail-only, each for the reason `@smartput/query`'s vocabulary
 * writes out: a politeness word dropped anywhere else is free to swallow the
 * operand in front of it.
 *
 * The whole unstripped input is always among the results, and the result is
 * sorted shortest-span-first so the most-stripped reading leads. A message
 * that looks like a carrier and is not — "convert" as a surname, "it" as an
 * ordinary pronoun — must still have a candidate the model can score, and the
 * cheapest way to guarantee that is never to drop the original.
 */
export function carve(input: string, vocabs: readonly ChatVocabulary[]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const emit = (start: number, end: number, head: string, tail: string): void => {
    if (end <= start) return;
    const key = `${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    const text = input.slice(start, end);
    // `frame` is spread in only when matched: under
    // `exactOptionalPropertyTypes` an explicit `undefined` is not the same as
    // an absent optional property, and `Candidate.frame` is optional.
    const frame = frameOf(text, vocabs);
    out.push({
      span: { start, end },
      text,
      ...(frame === undefined ? {} : { frame }),
      holes: holesOf(text, vocabs),
      stripped: { head, tail },
    });
  };

  // Always first: the message as sent.
  emit(0, input.length, "", "");

  let start = 0;
  let end = input.length;
  let head = "";
  let tail = "";

  // Head — greetings, then openers, each removed at most once. Two passes and
  // not a loop: a loop would let a message made entirely of carrier words strip
  // itself to nothing, and "hi hi hi convert" is not a message anyone sends.
  for (const list of [
    vocabs.flatMap((v) => v.greetings),
    vocabs.flatMap((v) => v.leading),
  ]) {
    const slice = input.slice(start, end);
    const lead = slice.length - slice.trimStart().length;
    const hit = matchAtHead(slice.trimStart(), list);
    if (hit === undefined) continue;
    const rest = slice.trimStart().slice(hit.length);
    const punct = HEAD_PUNCT.exec(rest)?.[0].length ?? 0;
    const removed = fold(slice.slice(lead, lead + hit.length + punct)).trim();
    head = head === "" ? removed : `${head} ${removed}`;
    start += lead + hit.length + punct;
    emit(start, end, head, tail);
  }

  // Tail — once.
  const slice = input.slice(start, end);
  const trimmed = slice.trimEnd();
  const hit = matchAtTail(
    trimmed,
    vocabs.flatMap((v) => v.trailing),
  );
  if (hit !== undefined) {
    tail = fold(trimmed.slice(trimmed.length - hit.length));
    end = start + trimmed.length - hit.length;
    // Drop the separator the politeness word hung off.
    while (end > start && BOUND.test(input.charAt(end - 1))) end--;
    emit(start, end, head, tail);
  }

  // Most-stripped first: the shortest span is the one a human would name as
  // "the request", and every caller that destructures `[top]` wants it.
  return out.sort((a, b) => a.text.length - b.text.length);
}
