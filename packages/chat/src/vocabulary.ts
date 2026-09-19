import type { ChatVocabulary } from "./types";

/**
 * English.
 *
 * The two end-restricted lists are lifted from `@smartput/query`'s vocabulary,
 * where `leading` is stripped only at the front and `trailing` only at the
 * tail, each for a reason that file writes out: dropped anywhere else,
 * "please" is free to swallow the operand in front of it. Chat lifts the same
 * rule from one resolver to all of them and adds the two forms query never had
 * to read — a greeting at the head, and an intent frame that names a target.
 *
 * `frames` keys are frame ids, not resolver ids: several resolvers may answer
 * one frame, and one resolver may answer several. The model decides which,
 * which is the whole reason frames carry no resolver name.
 */
export const chatEn: ChatVocabulary = {
  id: "en",
  greetings: ["hi", "hey", "hello", "yo", "morning", "good morning", "good evening"],
  // "whats" without the apostrophe is deliberate: `normalize` has not run on
  // this string, chat input is typed fast, and the elided form is what people
  // send. The apostrophised spellings sit beside it rather than replacing it.
  leading: [
    "what is",
    "what's",
    "whats",
    "how much is",
    "how many",
    "how long is",
    "how far is",
    "can you",
    "could you",
    "please",
    "tell me",
    "show me",
    "i need",
    "i want",
  ],
  trailing: ["please", "thanks", "thank you", "ty", "cheers", "pls"],
  referents: ["this", "that", "it", "the result", "the answer", "ans"],
  frames: {
    convert: ["convert", "turn", "change", "make"],
    compute: ["calculate", "compute", "work out", "evaluate"],
    compare: ["compare", "which is bigger", "which is more"],
  },
  interrogatives: ["what", "how", "which", "when", "where", "why", "who"],
};
