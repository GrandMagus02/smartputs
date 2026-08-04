import { Decimal } from "../decimal";
import type { Locale, NumberFormatSpec } from "../types";

const cache = new Map<string, NumberFormatSpec>();

export function numberSymbols(locale: Locale): NumberFormatSpec {
  if (locale.numberFormat !== "intl") return locale.numberFormat;

  const hit = cache.get(locale.id);
  if (hit !== undefined) return hit;

  const parts = new Intl.NumberFormat(locale.id).formatToParts(1234567.5);
  const spec: NumberFormatSpec = {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
  cache.set(locale.id, spec);
  return spec;
}

export function parseNumber(text: string, locale: Locale): Decimal | null {
  const { group, decimal } = numberSymbols(locale);
  let cleaned = "";
  for (const ch of text) {
    // Escapes, not literals: NBSP and narrow NBSP are invisible in source and
    // silently degrade to a plain space when retyped. French ICU uses U+202F as
    // its group separator, so this is load-bearing, not defensive padding.
    if (ch === group || ch === "\u00A0" || ch === "\u202F") continue;
    cleaned += ch === decimal ? "." : ch;
  }
  if (cleaned.length === 0 || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  try {
    return new Decimal(cleaned);
  } catch {
    return null;
  }
}
