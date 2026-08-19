import {
  Decimal,
  defineKind,
  type Kind,
  type LiteralMatcher,
  type Value,
} from "@smartput/kind";
import { Color, type SpaceId } from "@urcolor/core";

/**
 * The kind whose values are the *name of a channel* rather than a colour.
 *
 * It exists so that "red of #eeff66" is an ordinary `of` signature — the same
 * operator `20% of 50` uses — instead of a new operator core would have to
 * learn. `OpSymbol` is a closed union and `Keyword` is a closed union, so a
 * kind that wants a new binary reading has exactly two honest moves: put a
 * kind on one side of an operator that already exists, or claim the whole
 * phrase as a literal. This is the first; `expression.ts` is the second.
 *
 * Its canonical is the channel's index in {@link CHANNELS} — a stable id and
 * nothing more, in the tradition of `place`'s GeoNames id. Not `ordered`: one
 * channel is not greater than another.
 */
export const CHANNEL_KIND = "color-channel";

/**
 * How a channel word is read and written.
 *
 * `space` is where the channel is *always* read and written, never "the
 * colour's own space if it happens to have one of that name". The short keys
 * collide across spaces — `b` is sRGB blue, HWB blackness and Lab's b axis, and
 * `l` is HSL lightness (0–100) beside Oklch lightness (0–1) — so resolving in
 * place would make "blackness of #eeff66" answer with blue for a colour that
 * arrived as hex and with blackness for one that arrived as `hwb(…)`. One space
 * per channel word, always converted into, is the only rule a reader can
 * predict.
 *
 * `listSpaces` is the separate question of which spaces the channel may help
 * *define* — "100 hue 100 sat 50 brightness" is HSV, and hue is at home there
 * as much as in HSL. It is a superset of `space` and never a different scale:
 * hue is degrees everywhere it appears, saturation a percentage in both HSL and
 * HSV. A channel whose scale would change with the space (Oklch's lightness) is
 * simply not offered for list definitions.
 *
 * `scale` is what the channel's CSS unit is worth: a number the user types is
 * in CSS units, so `red` is 0–255, `hue` is degrees, and the 0–1 native
 * channels are percentages. `100%` means `percentRef` (360 for an angle), which
 * is what makes "with 50% saturation" and "with 50 saturation" the same colour.
 */
export interface ChannelDef {
  /**
   * Registry id, and the unit this kind's values carry.
   *
   * Prefixed and hyphenated so that it is not a word anybody can type. Ruling
   * R2 indexes every unit under its own id, so ids of `red` and `hue` would put
   * those two words in the *global* alias index — and "100 hue" would parse as
   * a quantity of one hue, printing "hue" and dropping the 100. The words for
   * a channel arrive through the literal matcher below instead, where they can
   * be weighted, refused next to a registered unit, and translated.
   */
  readonly id: string;
  /** English display name, and what `format` prints. */
  readonly label: string;
  /** Coordinate name within {@link space}. */
  readonly key: string;
  readonly space: SpaceId;
  /** Spaces a channel-list definition may build from this channel. */
  readonly listSpaces: readonly SpaceId[];
  /** CSS-unit value of a full channel. Native = css / scale. */
  readonly scale: number;
  /** What `100%` is worth in CSS units. Differs from `scale` only for angles. */
  readonly percentRef: number;
  readonly aliases: readonly string[];
}

/**
 * Alpha is not a coordinate — it lives beside the tuple on every `Color` — so
 * it carries a sentinel `key` and both readers branch on it. One special case,
 * spelled once, beats a fourth coordinate that only some spaces have.
 */
export const ALPHA_KEY = "";

interface ChannelInit {
  label: string;
  key: string;
  space: SpaceId;
  scale: number;
  aliases: readonly string[];
  listSpaces?: readonly SpaceId[];
  percentRef?: number;
}

const channel = (init: ChannelInit): ChannelDef => ({
  id: `ch-${init.label.toLowerCase()}`,
  label: init.label,
  key: init.key,
  space: init.space,
  listSpaces: init.listSpaces ?? [init.space],
  scale: init.scale,
  percentRef: init.percentRef ?? init.scale,
  aliases: init.aliases,
});

export const CHANNELS: readonly ChannelDef[] = [
  channel({ label: "Red", key: "r", space: "srgb", scale: 255, aliases: ["red"] }),
  channel({ label: "Green", key: "g", space: "srgb", scale: 255, aliases: ["green"] }),
  channel({ label: "Blue", key: "b", space: "srgb", scale: 255, aliases: ["blue"] }),
  channel({
    label: "Hue",
    key: "h",
    space: "hsl",
    scale: 1,
    percentRef: 360,
    listSpaces: ["hsl", "hsv", "hwb"],
    aliases: ["hue"],
  }),
  channel({
    label: "Saturation",
    key: "s",
    space: "hsl",
    scale: 100,
    listSpaces: ["hsl", "hsv"],
    aliases: ["saturation", "sat"],
  }),
  channel({
    label: "Lightness",
    key: "l",
    space: "hsl",
    scale: 100,
    aliases: ["lightness", "light"],
  }),
  channel({
    label: "Brightness",
    key: "v",
    space: "hsv",
    scale: 100,
    aliases: ["brightness", "value", "brt"],
  }),
  channel({
    label: "Whiteness",
    key: "w",
    space: "hwb",
    scale: 100,
    aliases: ["whiteness", "white"],
  }),
  channel({
    label: "Blackness",
    key: "b",
    space: "hwb",
    scale: 100,
    aliases: ["blackness", "black"],
  }),
  // Oklch only, and deliberately absent from every `listSpaces`: a set of
  // {lightness, chroma, hue} would need lightness on a 0–1 scale, which is not
  // the 0–100 the same word means in HSL. `in oklch` says which one it means.
  channel({
    label: "Chroma",
    key: "c",
    space: "oklch",
    scale: 1,
    percentRef: 0.4,
    listSpaces: [],
    aliases: ["chroma", "chr"],
  }),
  channel({
    label: "Alpha",
    key: ALPHA_KEY,
    space: "srgb",
    scale: 100,
    listSpaces: ["srgb", "hsl", "hsv", "hwb"],
    aliases: ["alpha", "opacity"],
  }),
];

/**
 * No single-letter aliases. `h` is an hour, `s` is a second, `b` is a byte and
 * `g` is a gram in the packages most consumers register beside this one, and
 * while `MatchCtx.isUnitAlias` refuses those the moment the other kind is
 * present, an engine that registers colour alone would read "5 s" as a
 * saturation. A channel is named by a word here, always.
 */
const BY_ALIAS = new Map<string, ChannelDef>();
for (const def of CHANNELS) {
  for (const alias of def.aliases) BY_ALIAS.set(alias, def);
}

const BY_ID = new Map(CHANNELS.map((def) => [def.id, def]));
const BY_LABEL = new Map(CHANNELS.map((def) => [def.label, def]));

/** The channel a word names in English, or `undefined`. Case-folded by the caller. */
export const channelFor = (word: string): ChannelDef | undefined => BY_ALIAS.get(word);

export const channelById = (id: string): ChannelDef | undefined => BY_ID.get(id);

/** The channel with this English display name — the key `ChannelNames` uses. */
export const channelByLabel = (label: string): ChannelDef | undefined =>
  BY_LABEL.get(label);

/** The channel's value in CSS units — 0–255 for `red`, degrees for `hue`. */
export function readChannel(color: Color, def: ChannelDef): number {
  if (def.key === ALPHA_KEY) return color.alpha * def.scale;
  return color.to(def.space).get(def.key) * def.scale;
}

/** A copy of `color` with `def` set to `css`, given in CSS units. */
export function writeChannel(color: Color, def: ChannelDef, css: number): Color {
  const native = css / def.scale;
  if (def.key === ALPHA_KEY) return color.withAlpha(native);
  return color.with({ space: def.space, [def.key]: native });
}

/**
 * The spaces a channel-list definition may name, in the order ties are broken.
 *
 * Only the four whose channel words are unambiguous in English. Lab, Lch and
 * their Ok- counterparts are reachable with `in oklch`, which is one
 * conversion away and says which of the two pairs it means.
 */
const LIST_SPACES: readonly {
  space: SpaceId;
  keys: readonly [string, string, string];
}[] = [
  { space: "srgb", keys: ["r", "g", "b"] },
  { space: "hsl", keys: ["h", "s", "l"] },
  { space: "hsv", keys: ["h", "s", "v"] },
  { space: "hwb", keys: ["h", "w", "b"] },
];

export interface ChannelAmount {
  readonly def: ChannelDef;
  /** In the channel's CSS units — 0–255 for red, degrees for hue. */
  readonly css: number;
}

/**
 * A colour from a full set of named channels — "100 hue 100 sat 50 brightness".
 *
 * All three coordinates of some space, or nothing. A partial set would need
 * defaults for the rest, and there is no defensible default: "100 hue" alone is
 * a hue, not a colour, and answering it with a fully saturated one invents the
 * two numbers the user did not type. Alpha is the exception and is genuinely
 * optional, because 1 is what every colour without one already has.
 */
export function colorFromChannels(given: readonly ChannelAmount[]): Color | null {
  const alpha = given.find((g) => g.def.key === ALPHA_KEY);
  const coords = given.filter((g) => g.def.key !== ALPHA_KEY);
  if (coords.length !== 3) return null;
  if (new Set(coords.map((g) => g.def.key)).size !== 3) return null;

  for (const candidate of LIST_SPACES) {
    // A channel must be at home in this space, not merely share a letter with
    // it: `b` is blue in sRGB and blackness in HWB, so {hue, whiteness, blue}
    // must not quietly become HWB.
    if (!coords.every((g) => g.def.listSpaces.includes(candidate.space))) continue;
    if (!coords.every((g) => candidate.keys.includes(g.def.key))) continue;
    const tuple = candidate.keys.map((key) => {
      const hit = coords.find((g) => g.def.key === key) as ChannelAmount;
      return hit.css / hit.def.scale;
    });
    return new Color(
      candidate.space,
      [tuple[0] as number, tuple[1] as number, tuple[2] as number],
      alpha === undefined ? 1 : alpha.css / alpha.def.scale,
    );
  }
  return null;
}

/**
 * What a channel word scores, and why it is negative.
 *
 * `red`, `green`, `blue`, `value`, `light` and `black` are ordinary English
 * words before they are channels, and `red` is a CSS keyword besides — so a
 * bare "red" has three readings and this one must not be the confident
 * default. It becomes the winner only when an `of` sits beside it, which is
 * the solver's job: `of | color-channel | color` is the only signature that
 * consumes this kind at all.
 */
export const DEFAULT_CHANNEL_WEIGHT = -8;

/**
 * Extra words that name a channel, beyond the English aliases above.
 *
 * Keys are case-folded surfaces, values are channel ids. `@smartput/color/i18n`
 * builds one of these from `@urcolor/i18n`'s `ChannelNames`, which translates
 * the same twelve labels into 77 languages — so "насиченість", "彩度" and
 * "Sättigung" reach this kind without a word of it living in this repository.
 */
export type ChannelWords = Readonly<Record<string, string>>;

/** A channel word in English or in any loaded translation. */
export const resolveChannel = (
  word: string,
  words: ChannelWords = {},
): ChannelDef | undefined => channelFor(word) ?? channelById(words[word] ?? "");

export interface ChannelKindOptions {
  words?: ChannelWords;
  weight?: number;
}

const LETTERS = /[\p{L}\p{M}]/u;

/**
 * How many words a channel name may span.
 *
 * Two, because Arabic's hue is `درجة اللون` — literally "degree of the colour"
 * — and one-word scanning read `درجة` and gave up. Nothing in
 * `ChannelNames`'s seventy-seven languages needs three.
 */
export const MAX_CHANNEL_WORDS = 2;

/**
 * The channel named at `offset`, longest name first, or `null`.
 *
 * Unicode letters and marks, not `[a-z]`: the words this has to read are
 * `насиченість`, `sättigung`, `kırmızı`, `明るさ` and `लाल`, and an ASCII scan
 * stopped at the first one of those in every language but English. The same
 * mistake `lex` documents at length for Devanagari, made here and fixed here.
 */
export function matchChannelWord(
  input: string,
  offset: number,
  words: ChannelWords = {},
): { def: ChannelDef; end: number; text: string } | null {
  let end = offset;
  const ends: number[] = [];
  for (let word = 0; word < MAX_CHANNEL_WORDS; word += 1) {
    if (word > 0) {
      let gap = end;
      while (input[gap] === " " || input[gap] === "\t") gap += 1;
      if (gap === end) break;
      end = gap;
    }
    const start = end;
    while (end < input.length && LETTERS.test(input[end] as string)) end += 1;
    if (end === start) break;
    ends.push(end);
  }
  for (let i = ends.length - 1; i >= 0; i -= 1) {
    const stop = ends[i] as number;
    const def = resolveChannel(input.slice(offset, stop).toLowerCase(), words);
    if (def !== undefined) return { def, end: stop, text: input.slice(offset, stop) };
  }
  return null;
}

export function createChannelLiteral(opts: ChannelKindOptions = {}): LiteralMatcher {
  const weight = opts.weight ?? DEFAULT_CHANNEL_WEIGHT;
  const words = opts.words ?? {};

  return (input, offset, ctx) => {
    const hit = matchChannelWord(input, offset, words);
    if (hit === null) return null;
    const { def, end } = hit;
    if (ctx.isUnitAlias(hit.text.toLowerCase())) return null;
    return {
      kind: CHANNEL_KIND,
      unit: def.id,
      canonical: new Decimal(CHANNELS.indexOf(def)),
      meta: Object.freeze({ channel: def.id, label: def.label }),
      length: end - offset,
      weight,
    };
  };
}

/** A channel `Value`, for a caller building one by hand. */
export const channelValue = (def: ChannelDef): Value =>
  Object.freeze({
    kind: CHANNEL_KIND,
    canonical: new Decimal(CHANNELS.indexOf(def)),
    unit: def.id,
    meta: Object.freeze({ channel: def.id, label: def.label }),
  });

/**
 * The channel kind. Registered by `COLOR_KINDS` alongside the colour kind,
 * because a channel with no colour to read it from is not useful on its own and
 * the pair is what makes `of` resolve.
 */
export function defineColorChannel(opts: ChannelKindOptions = {}): Kind {
  return defineKind({
    id: CHANNEL_KIND,
    value: { mode: "opaque", units: CHANNELS.map((def) => def.id) },
    literals: [createChannelLiteral(opts)],
    format: (value) => channelById(value.unit)?.label ?? value.unit,
  });
}

export const colorChannel: Kind = defineColorChannel();
