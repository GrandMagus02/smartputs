import type { Result } from "@smartput/core";
import { ChatError } from "../errors";
import type { Candidate, ResolveCtx, Resolver } from "../types";

/** See `evaluate.ts`: the interface's `resolve` is `T | Promise<T>`, and this
 * resolver's never is. */
type SyncResolver = {
  resolve(candidate: Candidate, ctx: ResolveCtx): Result;
} & Resolver<Result>;

/** The frame word, and any referent standing where the source should be. */
const LEAD = /^\s*(convert|turn|change|make)\b\s*/i;
const REFERENT = /\b(this|that|it|the result|the answer|ans)\b/i;

/**
 * Conversion, including the form where the source came from the last turn.
 *
 * The filled value is spliced back in as the SURFACE it was typed as — "5
 * pounds" — and the whole string is handed to the engine. Rebuilding a display
 * number from `Value.canonical` would mean dividing by the unit's ratio here,
 * and this package does no arithmetic: every number in a `ChatResult` came out
 * of the engine (design §4).
 */
export const convertResolver: SyncResolver = {
  id: "convert",
  frames: { en: ["convert", "turn", "change", "make"] },
  prototypes: {
    en: [
      "convert this to kilograms",
      "can you turn that into miles",
      "change it to celsius",
      "make that kg",
      "what is 5 lb in kg",
    ],
  },
  resolve(candidate: Candidate, ctx: ResolveCtx): Result {
    const source = ctx.filled.find((f) => f.slot === "source");
    let text = candidate.text.replace(LEAD, "");
    if (source !== undefined) {
      if (!REFERENT.test(text)) {
        throw new ChatError(
          "resolve",
          "a source was filled but the payload names no referent",
        );
      }
      text = text.replace(REFERENT, source.text);
    }
    // The engine's own conversion keyword. "to kg" is chat's spelling of it.
    const normalized = text.replace(/\bto\b/i, "in");
    const found = ctx.engine.suggest(normalized);
    const top = found[0];
    if (top === undefined) {
      throw new ChatError(
        "resolve",
        `engine found no reading for ${JSON.stringify(normalized)}`,
      );
    }
    return top;
  },
};
