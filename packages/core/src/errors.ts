// Moved to `@smartput/kind`; re-exported here for the reason `decimal.ts` gives.
//
// The whole hierarchy moved rather than the two errors a kind throws, because
// splitting it would mean two `SmartputError` classes and an `instanceof` that
// answers differently depending on which half caught the throw.
//
// Named one by one rather than `export *`, which is not a style preference: a
// star re-export of an *external* package survives into `dist/index.js` as a
// star, and a consumer bundling `import { SmartputError } from "@smartput/core"`
// against that dist gets "No matching export". Listing them is what keeps core's
// published surface a list of names instead of a forwarding address.
export {
  AmbiguityError,
  DimensionMismatchError,
  DivideByZeroError,
  KeywordConflictError,
  KindConflictError,
  LocaleMismatchError,
  MissingRateError,
  NoCandidateError,
  RateProviderError,
  RatesNotReadyError,
  SmartputError,
  TooAmbiguousError,
  UnitParseError,
  UnknownKindError,
  VocabularyConflictError,
} from "@smartput/kind/errors";
