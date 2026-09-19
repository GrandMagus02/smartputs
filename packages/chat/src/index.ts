// `@smartput/chat` — a chat message to a resolved value. The barrel exports
// shapes and the error class; every later task adds its own line here.
export { carve } from "./carve";
export { ChatResolver, type ChatResolverOptions } from "./chat";
export { ChatError } from "./errors";
export type { FeatureInput, FeatureVector, Probe } from "./features";
export {
  carrierOf,
  featurize,
  NAMED_FEATURES,
  NGRAM_BUCKETS,
  namedFeatures,
  ngramFeatures,
  probe,
} from "./features";
export { fill, targetKindOf } from "./fill";
export type { EmbedScores, WeightTable } from "./model";
export { ABSTAIN, LinearModel } from "./model";
export { Conversation, type ConversationEntry } from "./state";
export type {
  Candidate,
  ChatResult,
  ChatVocabulary,
  Filled,
  Hole,
  ResolveCtx,
  Resolver,
} from "./types";
export { chatEn } from "./vocabulary";
