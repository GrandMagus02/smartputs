import type { SpaceId } from "@urcolor/core";
import type { ColorUnit } from "./value";

/**
 * One notation: its unit id, the words that name it, and how to write it back
 * as CSS.
 *
 * The table is here rather than in `locale/en.ts` because two very different
 * readers need it and a second copy would drift. `locale/shared.ts` turns it
 * into a `Vocabulary` — the aliases are what makes `in oklch` resolve — and
 * `matcher.ts` uses the same aliases to recognise the bracketless form
 * "rgb 255 60 128", where the word is not a conversion target but the head of
 * a colour. One table, both jobs.
 */
export interface NotationDef {
  /** The `color` kind's unit id, and a `ColorFormat` upstream understands. */
  readonly id: ColorUnit;
  /** Single-token words, in every language: CSS function names do not translate. */
  readonly aliases: readonly string[];
  readonly symbol: string;
  readonly label: string;
  /**
   * The CSS function this notation is written with, or `undefined` when it has
   * none. `hex` has none — `#rrggbb` is not a function — so it has no
   * bracketless form either, which is right: "hex 255 60 128" is not a thing
   * anybody writes.
   */
  readonly fn?: "rgb" | "hsl" | "hwb" | "lab" | "lch" | "oklab" | "oklch" | "color";
  /** First argument to `color()`, for the six notations written that way. */
  readonly space?: SpaceId;
}

/**
 * The fifteen CSS notations, spelled the way CSS spells them.
 *
 * Every alias is a single token: `lex` splits on a hyphen — it is an operator —
 * so `display-p3` and `xyz-d65` are unit **ids**, not words anybody can type,
 * and each gets a run-together spelling instead. The digit-bearing ones (`p3`,
 * `a98`, `rec2020`) survive lexing only because ruling R-B1 keeps a
 * letter-then-digit run whole when a vocabulary registers it, which is exactly
 * what this table does.
 */
export const NOTATIONS: readonly NotationDef[] = [
  { id: "hex", aliases: ["hex", "hexcode", "hexadecimal"], symbol: "hex", label: "hex" },
  { id: "srgb", aliases: ["rgb", "srgb"], symbol: "rgb", label: "rgb", fn: "rgb" },
  {
    id: "srgb-linear",
    aliases: ["srgblinear", "linearsrgb", "linearrgb"],
    symbol: "srgb-linear",
    label: "linear sRGB",
    fn: "color",
    space: "srgb-linear",
  },
  { id: "hsl", aliases: ["hsl"], symbol: "hsl", label: "hsl", fn: "hsl" },
  { id: "hwb", aliases: ["hwb"], symbol: "hwb", label: "hwb", fn: "hwb" },
  { id: "lab", aliases: ["lab", "cielab"], symbol: "lab", label: "lab", fn: "lab" },
  { id: "lch", aliases: ["lch", "cielch"], symbol: "lch", label: "lch", fn: "lch" },
  { id: "oklab", aliases: ["oklab"], symbol: "oklab", label: "oklab", fn: "oklab" },
  { id: "oklch", aliases: ["oklch"], symbol: "oklch", label: "oklch", fn: "oklch" },
  {
    id: "display-p3",
    aliases: ["p3", "displayp3"],
    symbol: "display-p3",
    label: "Display P3",
    fn: "color",
    space: "display-p3",
  },
  {
    id: "a98-rgb",
    aliases: ["a98", "a98rgb", "adobergb"],
    symbol: "a98-rgb",
    label: "Adobe RGB",
    fn: "color",
    space: "a98-rgb",
  },
  {
    id: "prophoto-rgb",
    aliases: ["prophoto", "prophotorgb"],
    symbol: "prophoto-rgb",
    label: "ProPhoto RGB",
    fn: "color",
    space: "prophoto-rgb",
  },
  {
    id: "rec2020",
    aliases: ["rec2020"],
    symbol: "rec2020",
    label: "Rec. 2020",
    fn: "color",
    space: "rec2020",
  },
  {
    id: "xyz-d65",
    aliases: ["xyz", "xyzd65"],
    symbol: "xyz",
    label: "XYZ",
    fn: "color",
    space: "xyz-d65",
  },
  {
    id: "xyz-d50",
    aliases: ["xyzd50"],
    symbol: "xyz-d50",
    label: "XYZ D50",
    fn: "color",
    space: "xyz-d50",
  },
];

const BY_ALIAS = new Map<string, NotationDef>();
for (const def of NOTATIONS) {
  for (const alias of def.aliases) BY_ALIAS.set(alias, def);
}

/** The notation a word names, or `undefined`. Case-folded by the caller. */
export const notationFor = (word: string): NotationDef | undefined => BY_ALIAS.get(word);

/**
 * The CSS text for a bracketless claim — "rgb 255 60 128" becomes
 * "rgb(255 60 128)", "p3 1 0 0" becomes "color(display-p3 1 0 0)".
 *
 * Reassembled and handed to `tryParse` rather than converted here, so the
 * numbers are interpreted by exactly the code that interprets them inside
 * brackets. Percentages, `none`, angle units and the `/ alpha` form all keep
 * working because nothing in this package looks at them.
 */
export function cssFor(
  def: NotationDef,
  args: readonly string[],
  alpha?: string,
): string {
  if (def.fn === undefined) return "";
  const head = def.fn === "color" ? `${def.space} ${args.join(" ")}` : args.join(" ");
  return `${def.fn}(${head}${alpha === undefined ? "" : ` / ${alpha}`})`;
}
