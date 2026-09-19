// `@smartput/chat` — a chat message to a resolved value. The barrel exports
// shapes and the error class; every later task adds its own line here.
export { ChatError } from "./errors";
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
