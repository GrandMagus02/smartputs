import type { Decimal } from "../decimal";
import { fromCanonical } from "../eval/convert";
import { NUMBER_KIND, type Registry } from "../kind/registry";
import { numberSymbols } from "../locale/number";
import type { Locale, Value } from "../types";

function formatNumber(value: Decimal, locale: Locale): string {
  // Intl cannot take a Decimal, and Number() would lose precision on long
  // values, so reformat the digit string by hand using the locale's own
  // symbols. numberSymbols() is the single source of those symbols — deriving
  // them from Intl here would ignore a locale's own NumberFormatSpec and break
  // parse(format(v)) === v.
  const { group, decimal } = numberSymbols(locale);

  // toFixed(), not toString(): toString() switches to exponential notation
  // outside Decimal's toExpNeg/toExpPos window, which the grouping below would
  // pass through ungrouped and parseNumber() would then reject.
  const text = value.toFixed();
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [intPart = "0", fracPart] = body.split(".");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const joined = fracPart === undefined ? grouped : `${grouped}${decimal}${fracPart}`;
  return negative ? `-${joined}` : joined;
}

export function formatValue(value: Value, registry: Registry, locale: Locale): string {
  const kind = registry.kinds.get(value.kind);
  if (kind === undefined) return value.canonical.toFixed();
  if (kind.format !== undefined) return kind.format(value, { locale: locale.id });

  const authored =
    kind.spec.mode === "ratio"
      ? fromCanonical(
          value.canonical,
          kind,
          value.unit,
          locale.id,
          value.meta as Record<string, unknown>,
        )
      : value.canonical;

  const numberText = formatNumber(authored, locale);
  if (value.kind === NUMBER_KIND) return numberText;

  const unit = kind.units.get(value.unit);
  const lexeme = unit?.lexeme;
  const category = new Intl.PluralRules(locale.id).select(authored.toNumber());
  const display = lexeme?.display?.[category];

  if (display !== undefined) return `${numberText} ${display}`;
  return `${numberText}${lexeme?.symbol ?? value.unit}`;
}
