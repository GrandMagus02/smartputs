// `@smartput/core/scan` — prose segmentation alone: `Scanner` finds the
// quantities inside free text and `collectCues` is the context walk that biases
// them, without pulling in the evaluator or printer.
export type { CollectCuesArgs, CueHit } from "./scan/cues";
export { CUE_CEILING, collectCues } from "./scan/cues";
export type { ScanMatch, ScannerOptions, ScanScope } from "./scan/scan";
export { DEFAULT_CUE_WINDOW, DEFAULT_MAX_SPAN, Scanner } from "./scan/scan";
