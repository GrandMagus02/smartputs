// `@smartput/chat/resolvers` — the two resolvers that need nothing but the
// engine. Resolvers over `math`, `distance`, `translate` and `query` are the
// consumer's to write: bundling them would make this package depend on six
// others to serve someone who wanted one (design §2).
export { convertResolver } from "./convert";
export { evaluateResolver } from "./evaluate";
