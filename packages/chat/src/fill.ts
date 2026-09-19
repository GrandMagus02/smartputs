import type { Engine, Mark } from "@smartput/core";
import type { KindId } from "@smartput/kind/types";
import type { Conversation } from "./state";
import type { Candidate, Filled } from "./types";

/**
 * The kind the target unit names — what "to kg" says the hole must hold.
 *
 * The LAST mark inside the candidate, because the target is written after the
 * source in every frame this vocabulary lists: "convert X to Y".
 *
 * `scan` alone is not enough for the case that matters here. A mark is a
 * quantity, so it needs a number, and the hole is exactly where the number is
 * missing: "convert this to kg" scans to nothing at all. `complete` is the
 * door that reads a bare unit — it is the keystroke API, so naming a unit with
 * no value in front of it is its ordinary input — and its span is required to
 * end where the candidate ends, so it answers about the TARGET and not about
 * some unit earlier in the phrase.
 */
export function targetKindOf(
  candidate: Candidate,
  marks: readonly Mark[],
  engine: Engine,
): KindId | undefined {
  const inside = marks.filter(
    (m) => m.start >= candidate.span.start && m.end <= candidate.span.end,
  );
  const marked = inside[inside.length - 1]?.readings[0]?.kind;
  if (marked !== undefined) return marked;
  const trailing = engine
    .complete(candidate.text)
    .find((c) => c.span.end === candidate.text.length);
  return trailing?.kind;
}

/**
 * Take a value out of state for every hole the candidate left open.
 *
 * The kind constraint is the whole mechanism: `carve` emits a hole with an
 * empty kind because it has not read the target unit yet, `targetKindOf`
 * narrows it, and `Conversation.entries(kind)` does the rest. A state holding
 * one length and one mass has no contest to resolve when the target is
 * kilograms — the kind system is the coreference resolver (design §4.5).
 *
 * Fills nothing rather than guessing when no compatible value is in reach. The
 * caller sees an unfilled hole and abstains, which is the honest outcome: the
 * information is not there.
 */
export function fill(
  candidate: Candidate,
  marks: readonly Mark[],
  conversation: Conversation,
  engine: Engine,
): Filled[] {
  const out: Filled[] = [];
  const target = targetKindOf(candidate, marks, engine);
  for (const hole of candidate.holes) {
    const kind = hole.kind === "" ? target : hole.kind;
    if (kind === undefined) continue;
    const entry = conversation.entries(kind)[0];
    if (entry === undefined) continue;
    out.push({ slot: hole.slot, from: "state", value: entry.value, text: entry.text });
  }
  return out;
}
