// `@smartput/core/normalize` — the Normalizer stage alone, spec §6. A
// consumer who only wants NFKC/whitespace normalization does not pay for the
// tokenizer, parser, solver, evaluator or registry.
export type {
  Edit,
  EditReason,
  NormalizedInput,
  NormalizerOptions,
} from "./parse/normalize";
export { Normalizer, normalize } from "./parse/normalize";
