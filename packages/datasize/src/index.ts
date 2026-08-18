import { decimalRatios, defineKind } from "@smartput/kind";
import { DATASIZE_UNITS } from "./units";

export type { DatasizeUnit } from "./units";
export { DATASIZE_UNITS } from "./units";

export const datasize = defineKind({
  id: "datasize",
  value: {
    mode: "ratio",
    canonical: DATASIZE_UNITS.canonical,
    units: decimalRatios(DATASIZE_UNITS),
  },
  // No `compound: true`, and the omission is a decision rather than an
  // oversight: nobody writes "1 gb 500 mb". A file size is one number in one
  // unit, so folding two of them would only ever turn a typo into an answer —
  // and the units here are ordered exactly the way a fold would want, which is
  // why the refusal has to be stated rather than left to the ordering test.
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  // The binary units band to 1024 where their decimal twins band to 1000,
  // which is the same distinction the ratios draw.
  typical: {
    b: [1, 1024],
    kb: [1, 1000],
    mb: [1, 1000],
    gb: [0.5, 1000],
    tb: [0.1, 100],
    kib: [1, 1024],
    mib: [1, 1024],
    gib: [0.5, 1024],
    tib: [0.1, 100],
  },
});
