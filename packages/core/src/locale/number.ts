import { Decimal } from "../decimal";
import type { Language, NumberFormatSpec } from "../types";

const cache = new Map<string, NumberFormatSpec>();

export function numberSymbols(language: Language): NumberFormatSpec {
  if (language.numberFormat !== "intl") return language.numberFormat;

  const hit = cache.get(language.id);
  if (hit !== undefined) return hit;

  const parts = new Intl.NumberFormat(language.id).formatToParts(1234567.5);
  const spec: NumberFormatSpec = {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
  cache.set(language.id, spec);
  return spec;
}

export function parseNumber(text: string, language: Language): Decimal | null {
  const { group, decimal } = numberSymbols(language);
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
