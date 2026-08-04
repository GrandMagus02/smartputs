import { fromCanonical } from "../eval/convert";
import { NUMBER_KIND, type Registry } from "../kind/registry";
import type { Value } from "../types";

function formatNumber(text: string, locale: string): string {
  // Intl cannot take a Decimal, and Number() would lose precision on long values,
  // so reformat the digit string by hand using the locale's own symbols.
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";

  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [intPart = "0", fracPart] = body.split(".");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const joined = fracPart === undefined ? grouped : `${grouped}${decimal}${fracPart}`;
  return negative ? `-${joined}` : joined;
}

export function formatValue(value: Value, registry: Registry, locale: string): string {
  const kind = registry.kinds.get(value.kind);
  if (kind === undefined) return value.canonical.toString();
  if (kind.format !== undefined) return kind.format(value, { locale });

  const authored =
    kind.spec.mode === "ratio"
      ? fromCanonical(
          value.canonical,
          kind,
          value.unit,
          locale,
          value.meta as Record<string, unknown>,
        )
      : value.canonical;

  const numberText = formatNumber(authored.toString(), locale);
  if (value.kind === NUMBER_KIND) return numberText;

  const unit = kind.units.get(value.unit);
  const lexeme = unit?.lexeme;
  const category = new Intl.PluralRules(locale).select(authored.toNumber());
  const display = lexeme?.display?.[category];

  if (display !== undefined) return `${numberText} ${display}`;
  return `${numberText}${lexeme?.symbol ?? value.unit}`;
}
