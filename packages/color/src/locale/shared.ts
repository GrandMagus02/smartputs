import type { Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";

/**
 * The notation names are not translated, and that is a finding rather than a
 * shortcut.
 *
 * `rgb`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `rec2020` and
 * `display-p3` are CSS Color 4 function names: they are typed the same in
 * Warsaw and in Seoul, because what a person types is the syntax, not a word
 * for it. Translating them would not add a phrasing anybody uses; it would add
 * a word to the *global* alias index in that language for no reader.
 *
 * So a locale file here carries the three things that genuinely differ — the
 * word for a hex code, the word for a colour's name, and the cues that argue a
 * nearby quantity is a colour at all — and inherits the rest. The alternative
 * was seventeen files repeating fifteen identical alias arrays, where a
 * notation added upstream would have to be added in seventeen places and would
 * be forgotten in three.
 *
 * Channel words are a different story and are not here: `hue` really is
 * "Farbton", and `@urcolor/i18n`'s `ChannelNames` already translates all twelve
 * into 77 languages. `@smartput/color/i18n`'s `channelWordsFor` is that door,
 * so not one translated channel word lives in this repository either.
 */
export interface NotationWords {
  /** Extra aliases for the hex notation, beyond `hex`. */
  hex?: readonly string[];
  /** Display forms for the hex notation. */
  hexForms?: { one: string; other: string };
  /** Extra aliases for the `name` notation, beyond `name`. */
  name?: readonly string[];
  /** Display forms for the `name` notation. */
  nameForms?: { one: string; other: string };
  /**
   * Words that, standing near a quantity, argue it is a colour. Single digits;
   * `CUE_CEILING` clamps the sum per kind per mark. A cue ranks readings that
   * already exist and never admits one, so none of these can turn a bare number
   * into a colour.
   */
  cues?: Readonly<Record<string, number>>;
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
const NOTATIONS = {
  hex: { aliases: ["hex", "hexcode", "hexadecimal"], symbol: "hex", label: "hex" },
  srgb: { aliases: ["rgb", "srgb"], symbol: "rgb", label: "rgb" },
  "srgb-linear": {
    aliases: ["srgblinear", "linearsrgb", "linearrgb"],
    symbol: "srgb-linear",
    label: "linear sRGB",
  },
  hsl: { aliases: ["hsl"], symbol: "hsl", label: "hsl" },
  hwb: { aliases: ["hwb"], symbol: "hwb", label: "hwb" },
  lab: { aliases: ["lab", "cielab"], symbol: "lab", label: "lab" },
  lch: { aliases: ["lch", "cielch"], symbol: "lch", label: "lch" },
  oklab: { aliases: ["oklab"], symbol: "oklab", label: "oklab" },
  oklch: { aliases: ["oklch"], symbol: "oklch", label: "oklch" },
  "display-p3": {
    aliases: ["p3", "displayp3"],
    symbol: "display-p3",
    label: "Display P3",
  },
  "a98-rgb": {
    aliases: ["a98", "a98rgb", "adobergb"],
    symbol: "a98-rgb",
    label: "Adobe RGB",
  },
  "prophoto-rgb": {
    aliases: ["prophoto", "prophotorgb"],
    symbol: "prophoto-rgb",
    label: "ProPhoto RGB",
  },
  rec2020: { aliases: ["rec2020"], symbol: "rec2020", label: "Rec. 2020" },
  "xyz-d65": { aliases: ["xyz", "xyzd65"], symbol: "xyz", label: "XYZ" },
  "xyz-d50": { aliases: ["xyzd50"], symbol: "xyz-d50", label: "XYZ D50" },
} as const;

/** Case-folded and de-duplicated, so a locale may repeat a Latin alias harmlessly. */
const merge = (base: readonly string[], extra: readonly string[] = []): string[] => [
  ...new Set([...base, ...extra.map((word) => word.toLowerCase())]),
];

/**
 * One language's words for the colour notations.
 *
 * Names `color` by **id string** rather than importing the kind, which is what
 * lets a translation ship from someone who is not the kind's author and lets
 * `@smartput/color/locale/uk` be imported without linking a colour library.
 */
export function notationVocabulary(
  locale: string,
  words: NotationWords = {},
): Vocabulary {
  const units: Record<string, unknown> = {};
  for (const [id, def] of Object.entries(NOTATIONS)) {
    units[id] = {
      aliases: id === "hex" ? merge(def.aliases, words.hex) : [...def.aliases],
      symbol: def.symbol,
      forms:
        id === "hex" && words.hexForms !== undefined
          ? words.hexForms
          : { one: def.label, other: def.label },
    };
  }
  // The one unit that is not a CSS notation: `name` is rendered by a
  // colour-naming dataset. It is listed unconditionally because `defineColor`
  // registers it unconditionally — a vocabulary naming a unit its kind did not
  // register is an `UnknownKindError` at `createEngine()`.
  units.name = {
    aliases: merge(["name"], words.name),
    symbol: "name",
    forms: words.nameForms ?? { one: "name", other: "names" },
  };

  return defineVocabulary({
    locale,
    kind: "color",
    units: units as Parameters<typeof defineVocabulary>[0]["units"],
    ...(words.cues === undefined ? {} : { cues: words.cues }),
  });
}
