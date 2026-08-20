import type { Engine, Kind, Vocabulary } from "@smartput/core";
import { composeLocale, createEngine } from "@smartput/core";
import { date } from "@smartput/date";
import { dateRange } from "@smartput/date-range";
import { datetime } from "@smartput/datetime";
import { datetimeRange } from "@smartput/datetime-range";
import {
  angle,
  area,
  boolean,
  datarate,
  datasize,
  duration,
  energy,
  length,
  mass,
  number,
  percent,
  power,
  speed,
  tempdelta,
  temperature,
  tempo,
  volume,
} from "@smartput/kinds";
import { RANGE_KINDS } from "@smartput/range";
import { money } from "@smartput/rate";
import { time } from "@smartput/time";
import { timeRange } from "@smartput/time-range";
import { DOCS_RATES } from "./engine";

/**
 * The lab's engine, assembled from whatever the sidebar has switched on.
 *
 * Every other demo on this site holds a fixed engine built at module scope,
 * because each one is illustrating a single entry point. This page is the
 * opposite: the composition *is* the subject, so the engine is rebuilt from a
 * pair of id lists whenever either changes.
 *
 * Two things follow from that, and both are why this file exists rather than
 * the page reaching for `createDocsEngine`. First, kinds and words are
 * separate axes here — `mass` the mechanics and `mass`'s Ukrainian words are
 * independently switchable, so a vocabulary is fetched per (module, locale)
 * pair rather than as one frozen bundle. Second, the words are the heavy half:
 * seventeen languages of every built-in kind is not something the rest of the
 * site should pay for, so every vocabulary below is a dynamic import and the
 * component that calls this is registered asynchronously.
 */

export interface LabLocale {
  readonly id: string;
  /** The language's name in English, for a reader who does not read it. */
  readonly label: string;
  /** The language's name in itself, which is what people scan a list for. */
  readonly native: string;
}

/**
 * Written out rather than derived. Vite can only code-split a dynamic import
 * it can read statically, so `import("@smartput/kinds/locale/" + id)` resolves
 * to nothing at build time — the seventeen entries in each map below are the
 * price of the chunking, and the lists cannot drift apart silently because
 * `localeIds()` is the only thing that enumerates them.
 */
export const LAB_LOCALES: readonly LabLocale[] = [
  { id: "en", label: "English", native: "English" },
  { id: "de", label: "German", native: "Deutsch" },
  { id: "fr", label: "French", native: "Français" },
  { id: "es", label: "Spanish", native: "Español" },
  { id: "it", label: "Italian", native: "Italiano" },
  { id: "pt", label: "Portuguese", native: "Português" },
  { id: "nl", label: "Dutch", native: "Nederlands" },
  { id: "pl", label: "Polish", native: "Polski" },
  { id: "uk", label: "Ukrainian", native: "Українська" },
  { id: "ru", label: "Russian", native: "Русский" },
  { id: "tr", label: "Turkish", native: "Türkçe" },
  { id: "ar", label: "Arabic", native: "العربية" },
  { id: "hi", label: "Hindi", native: "हिन्दी" },
  { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { id: "ja", label: "Japanese", native: "日本語" },
  { id: "ko", label: "Korean", native: "한국어" },
  { id: "zh", label: "Chinese", native: "中文" },
];

type Loader<T> = () => Promise<{ default?: T } & Record<string, unknown>>;

/** The `Language` half: how a language reads numbers, strips suffixes, segments. */
const LANGUAGES: Record<string, Loader<unknown>> = {
  en: () => import("@smartput/core/locale/en"),
  de: () => import("@smartput/core/locale/de"),
  fr: () => import("@smartput/core/locale/fr"),
  es: () => import("@smartput/core/locale/es"),
  it: () => import("@smartput/core/locale/it"),
  pt: () => import("@smartput/core/locale/pt"),
  nl: () => import("@smartput/core/locale/nl"),
  pl: () => import("@smartput/core/locale/pl"),
  uk: () => import("@smartput/core/locale/uk"),
  ru: () => import("@smartput/core/locale/ru"),
  tr: () => import("@smartput/core/locale/tr"),
  ar: () => import("@smartput/core/locale/ar"),
  hi: () => import("@smartput/core/locale/hi"),
  id: () => import("@smartput/core/locale/id"),
  ja: () => import("@smartput/core/locale/ja"),
  ko: () => import("@smartput/core/locale/ko"),
  zh: () => import("@smartput/core/locale/zh"),
};

/**
 * The built-in kinds' words, as one array per language. Filtered by kind id
 * below, so switching `mass` off removes its words as well as its mechanics —
 * anything less would leave "5 кілограмів" resolving against a kind that is no
 * longer registered.
 */
const BUILTIN_VOCAB: Record<string, Loader<readonly Vocabulary[]>> = {
  en: () => import("@smartput/kinds/locale/en"),
  de: () => import("@smartput/kinds/locale/de"),
  fr: () => import("@smartput/kinds/locale/fr"),
  es: () => import("@smartput/kinds/locale/es"),
  it: () => import("@smartput/kinds/locale/it"),
  pt: () => import("@smartput/kinds/locale/pt"),
  nl: () => import("@smartput/kinds/locale/nl"),
  pl: () => import("@smartput/kinds/locale/pl"),
  uk: () => import("@smartput/kinds/locale/uk"),
  ru: () => import("@smartput/kinds/locale/ru"),
  tr: () => import("@smartput/kinds/locale/tr"),
  ar: () => import("@smartput/kinds/locale/ar"),
  hi: () => import("@smartput/kinds/locale/hi"),
  id: () => import("@smartput/kinds/locale/id"),
  ja: () => import("@smartput/kinds/locale/ja"),
  ko: () => import("@smartput/kinds/locale/ko"),
  zh: () => import("@smartput/kinds/locale/zh"),
};

const MONEY_VOCAB: Record<string, Loader<Vocabulary>> = {
  en: () => import("@smartput/rate/locale/en"),
  de: () => import("@smartput/rate/locale/de"),
  fr: () => import("@smartput/rate/locale/fr"),
  es: () => import("@smartput/rate/locale/es"),
  it: () => import("@smartput/rate/locale/it"),
  pt: () => import("@smartput/rate/locale/pt"),
  nl: () => import("@smartput/rate/locale/nl"),
  pl: () => import("@smartput/rate/locale/pl"),
  uk: () => import("@smartput/rate/locale/uk"),
  ru: () => import("@smartput/rate/locale/ru"),
  tr: () => import("@smartput/rate/locale/tr"),
  ar: () => import("@smartput/rate/locale/ar"),
  hi: () => import("@smartput/rate/locale/hi"),
  id: () => import("@smartput/rate/locale/id"),
  ja: () => import("@smartput/rate/locale/ja"),
  ko: () => import("@smartput/rate/locale/ko"),
  zh: () => import("@smartput/rate/locale/zh"),
};

const DATETIME_VOCAB: Record<string, Loader<Vocabulary>> = {
  en: () => import("@smartput/datetime/locale/en"),
  de: () => import("@smartput/datetime/locale/de"),
  fr: () => import("@smartput/datetime/locale/fr"),
  es: () => import("@smartput/datetime/locale/es"),
  it: () => import("@smartput/datetime/locale/it"),
  pt: () => import("@smartput/datetime/locale/pt"),
  nl: () => import("@smartput/datetime/locale/nl"),
  pl: () => import("@smartput/datetime/locale/pl"),
  uk: () => import("@smartput/datetime/locale/uk"),
  ru: () => import("@smartput/datetime/locale/ru"),
  tr: () => import("@smartput/datetime/locale/tr"),
  ar: () => import("@smartput/datetime/locale/ar"),
  hi: () => import("@smartput/datetime/locale/hi"),
  id: () => import("@smartput/datetime/locale/id"),
  ja: () => import("@smartput/datetime/locale/ja"),
  ko: () => import("@smartput/datetime/locale/ko"),
  zh: () => import("@smartput/datetime/locale/zh"),
};

const COLOR_VOCAB: Record<string, Loader<Vocabulary>> = {
  en: () => import("@smartput/color/locale/en"),
  de: () => import("@smartput/color/locale/de"),
  fr: () => import("@smartput/color/locale/fr"),
  es: () => import("@smartput/color/locale/es"),
  it: () => import("@smartput/color/locale/it"),
  pt: () => import("@smartput/color/locale/pt"),
  nl: () => import("@smartput/color/locale/nl"),
  pl: () => import("@smartput/color/locale/pl"),
  uk: () => import("@smartput/color/locale/uk"),
  ru: () => import("@smartput/color/locale/ru"),
  tr: () => import("@smartput/color/locale/tr"),
  ar: () => import("@smartput/color/locale/ar"),
  hi: () => import("@smartput/color/locale/hi"),
  id: () => import("@smartput/color/locale/id"),
  ja: () => import("@smartput/color/locale/ja"),
  ko: () => import("@smartput/color/locale/ko"),
  zh: () => import("@smartput/color/locale/zh"),
};

export interface LabModule {
  readonly id: string;
  readonly label: string;
  /** Which sidebar group it sits in. */
  readonly group: "Built-in" | "Time" | "Opt-in";
  readonly kinds: readonly Kind[];
  /**
   * Kind ids whose words come out of the built-in barrel. Empty for a module
   * whose vocabulary is its own import, or which ships no words at all.
   */
  readonly builtinVocab?: readonly string[];
  /** A vocabulary of its own, one per language. */
  readonly vocab?: Record<string, Loader<Vocabulary>>;
  /** Modules that must be on for this one to do anything. */
  readonly requires?: readonly string[];
  readonly note?: string;
}

/**
 * What the sidebar offers.
 *
 * `temperature` is one row and two kinds because `tempdelta` is not a thing
 * anyone would switch on by itself — it is what a subtraction of two
 * temperatures produces, so an engine with one and not the other answers
 * "30 C - 20 C" with an error nobody could act on.
 *
 * `measure` is absent, and deliberately: its mm/cm aliases collide with
 * `length`, which is why `BUILTIN_KINDS` leaves it out too. Offering it as a
 * toggle here would put an ambiguity in front of a first-time reader with no
 * way to understand where it came from.
 */
export const LAB_MODULES: readonly LabModule[] = [
  {
    id: "number",
    label: "Number",
    group: "Built-in",
    kinds: [number],
    builtinVocab: ["number"],
  },
  {
    id: "percent",
    label: "Percent",
    group: "Built-in",
    kinds: [percent],
    builtinVocab: ["percent"],
  },
  {
    id: "length",
    label: "Length",
    group: "Built-in",
    kinds: [length],
    builtinVocab: ["length"],
  },
  { id: "mass", label: "Mass", group: "Built-in", kinds: [mass], builtinVocab: ["mass"] },
  {
    id: "duration",
    label: "Duration",
    group: "Built-in",
    kinds: [duration],
    builtinVocab: ["duration"],
  },
  {
    id: "temperature",
    label: "Temperature",
    group: "Built-in",
    kinds: [temperature, tempdelta],
    builtinVocab: ["temperature", "tempdelta"],
    note: "Registers tempdelta too — it is what a subtraction returns.",
  },
  {
    id: "angle",
    label: "Angle",
    group: "Built-in",
    kinds: [angle],
    builtinVocab: ["angle"],
  },
  { id: "area", label: "Area", group: "Built-in", kinds: [area], builtinVocab: ["area"] },
  {
    id: "volume",
    label: "Volume",
    group: "Built-in",
    kinds: [volume],
    builtinVocab: ["volume"],
  },
  {
    id: "speed",
    label: "Speed",
    group: "Built-in",
    kinds: [speed],
    builtinVocab: ["speed"],
  },
  {
    id: "datasize",
    label: "Data size",
    group: "Built-in",
    kinds: [datasize],
    builtinVocab: ["datasize"],
  },
  {
    id: "datarate",
    label: "Data rate",
    group: "Built-in",
    kinds: [datarate],
    builtinVocab: ["datarate"],
  },
  {
    id: "power",
    label: "Power",
    group: "Built-in",
    kinds: [power],
    builtinVocab: ["power"],
  },
  {
    id: "energy",
    label: "Energy",
    group: "Built-in",
    kinds: [energy],
    builtinVocab: ["energy"],
  },
  {
    id: "tempo",
    label: "Tempo",
    group: "Built-in",
    kinds: [tempo],
    builtinVocab: ["tempo"],
  },
  {
    id: "boolean",
    label: "Boolean",
    group: "Built-in",
    kinds: [boolean],
    note: "Ships no vocabulary: its surfaces are the words themselves.",
  },
  {
    id: "datetime",
    label: "Datetime",
    group: "Time",
    kinds: [datetime],
    vocab: DATETIME_VOCAB,
    note: "Runs on a live clock, so 'today' means today.",
  },
  {
    id: "date",
    label: "Date",
    group: "Time",
    kinds: [date],
    requires: ["datetime"],
    note: "Parses nothing of its own; it re-reads datetime's match.",
  },
  { id: "time", label: "Time", group: "Time", kinds: [time], requires: ["datetime"] },
  {
    id: "ranges",
    label: "Ranges",
    group: "Time",
    kinds: [dateRange, timeRange, datetimeRange, ...RANGE_KINDS],
    requires: ["datetime"],
    note: "Every range kind at once — '2 to 5 kg', 'monday to friday'.",
  },
  {
    id: "money",
    label: "Money",
    group: "Opt-in",
    kinds: [money],
    vocab: MONEY_VOCAB,
    note: "Against a checked-in ECB snapshot, not a live quote.",
  },
  {
    id: "color",
    label: "Colour",
    group: "Opt-in",
    kinds: [],
    vocab: COLOR_VOCAB,
    note: "Claims words like 'tan' and 'gold', which is why it is opt-in.",
  },
];

/** Everything on, which is what the page starts with. */
export const ALL_MODULE_IDS: readonly string[] = LAB_MODULES.map((m) => m.id);
export const ALL_LOCALE_IDS: readonly string[] = LAB_LOCALES.map((l) => l.id);

const moduleById = new Map(LAB_MODULES.map((m) => [m.id, m]));

/**
 * Close a selection over `requires`.
 *
 * A reader who switches `ranges` on and `datetime` off has not asked for six
 * kinds that never claim anything; they have asked for ranges. Pulling the
 * prerequisite back in is the reading that matches the intent, and the sidebar
 * shows which rows were pulled so it is visible rather than mysterious.
 */
export function withPrerequisites(ids: readonly string[]): string[] {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...out]) {
      for (const need of moduleById.get(id)?.requires ?? []) {
        if (!out.has(need)) {
          out.add(need);
          grew = true;
        }
      }
    }
  }
  return [...out];
}

/** Colour is two kinds, and both are needed for `red of #eeff66` to resolve. */
async function colorKinds(): Promise<Kind[]> {
  const mod = await import("@smartput/color");
  return [...mod.COLOR_KINDS];
}

async function localeFor(
  localeId: string,
  moduleIds: readonly string[],
): Promise<ReturnType<typeof composeLocale>> {
  const language = ((await LANGUAGES[localeId]()) as { [k: string]: unknown }).default;

  const wantedBuiltins = new Set(
    moduleIds.flatMap((id) => moduleById.get(id)?.builtinVocab ?? []),
  );

  const vocabularies: Vocabulary[] = [];
  if (wantedBuiltins.size > 0) {
    const barrel = (await BUILTIN_VOCAB[localeId]()).default as readonly Vocabulary[];
    vocabularies.push(...barrel.filter((v) => wantedBuiltins.has(v.kind)));
  }

  for (const id of moduleIds) {
    const loader = moduleById.get(id)?.vocab?.[localeId];
    if (loader === undefined) continue;
    vocabularies.push((await loader()).default as Vocabulary);
  }

  // `english` and its siblings are a `Language`, not a `Locale`; only
  // `composeLocale` joins the grammar to the words, and `createEngine` throws
  // on the bare language. That failure is a boot-time one, which is why it is
  // worth naming here rather than discovering it at a keystroke.
  return composeLocale(language as Parameters<typeof composeLocale>[0], vocabularies);
}

export interface LabEngineRequest {
  readonly moduleIds: readonly string[];
  readonly localeIds: readonly string[];
  /** The one language the engine writes. Must be among `localeIds`. */
  readonly format: string;
}

/**
 * Build an engine for one sidebar state.
 *
 * `rates` goes in unconditionally. Money is the only kind that reads them and
 * an unused table costs nothing, whereas making the option conditional adds a
 * branch whose two sides would need testing separately.
 */
export async function buildLabEngine(req: LabEngineRequest): Promise<Engine> {
  const moduleIds = withPrerequisites(req.moduleIds);
  const localeIds = req.localeIds.length > 0 ? req.localeIds : ["en"];

  const locales = await Promise.all(localeIds.map((id) => localeFor(id, moduleIds)));

  const kinds: Kind[] = [];
  for (const id of moduleIds) {
    const mod = moduleById.get(id);
    if (mod === undefined) continue;
    kinds.push(...(id === "color" ? await colorKinds() : mod.kinds));
  }

  return createEngine({
    locales,
    // `format` must name an installed locale or `createEngine` throws on boot.
    // The caller keeps it inside the selection; this fallback is what makes
    // that a guarantee rather than a convention.
    format: localeIds.includes(req.format) ? req.format : localeIds[0],
    kinds,
    rates: DOCS_RATES,
    now: () => Date.now(),
    timeZone: "UTC",
  });
}
