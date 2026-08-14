import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { numberSymbols } from "./number";
import { portuguese } from "./pt";
import { CARDINALS, COMBINING_HUNDRED, SCALE_PLURALS } from "./pt-cardinals";

const form = (n: number, slot: Slot = "bare") =>
  portuguese.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

describe("portuguese", () => {
  test("takes its number symbols from CLDR, under the Brazilian default", () => {
    // Both separators are visible characters here, unlike Ukrainian's U+00A0
    // group — which is precisely the difference the bare `pt` tag decides:
    // `Intl.NumberFormat("pt")` resolves to the Brazilian defaults, while
    // "pt-PT" groups with U+00A0. Pinned so a runtime that changed its mind
    // fails here rather than in somebody's price list.
    expect(portuguese.id).toBe("pt");
    expect(numberSymbols(portuguese)).toEqual({ group: ".", decimal: "," });
    expect(new Intl.NumberFormat("pt").format(1234567.5)).toBe("1.234.567,5");
  });

  /**
   * The contract three later vocabularies key their `forms` tables off: exactly
   * two keys, `"one"` and `"other"`, on one axis. If this test has to change,
   * every Portuguese vocabulary in the repo changes with it.
   */
  test("selectForm returns exactly two keys, on one axis", () => {
    const slots: Slot[] = ["bare", "after-number", "conversion-target"];
    const counts = [0, 0.5, 1, 1.5, 2, 3, 10, 21, 100, 1000, 1e6, 2e6, 1e9];
    const keys = new Set<string>();
    for (const slot of slots) {
      keys.add(portuguese.selectForm({ kind: "mass", unit: "kg", slot }));
      for (const n of counts) keys.add(form(n, slot));
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
  });

  test("which key, for which count", () => {
    expect(form(1)).toBe("one");
    expect(form(2)).toBe("other");
    expect(form(100)).toBe("other");
    // Two rows English does not have. CLDR's Portuguese rule is `i = 0..1`, so
    // the integer part alone decides: zero is singular ("0 grama") and so is
    // any fraction below two ("1,5 quilograma", "0,5 litro") — the exact
    // opposite of English's "1.5 kilograms". These are the rows a vocabulary
    // author is likeliest to get wrong, because they look like typos.
    expect(form(0)).toBe("one");
    expect(form(0.5)).toBe("one");
    expect(form(1.5)).toBe("one");
    expect(form(1.99)).toBe("one");
    expect(form(2.5)).toBe("other");
  });

  test("CLDR's third category is folded away, not passed through", () => {
    // The platform really does return it, so this is a fold and not a
    // coincidence — if the fold is ever deleted, the first line keeps passing
    // and the second one fails.
    expect(new Intl.PluralRules("pt").select(1e6)).toBe("many");
    expect(form(1e6)).toBe("other");
    expect(form(2e6)).toBe("other");
    expect(form(1e9)).toBe("other");
  });

  test("a count-free conversion target still names a key", () => {
    // Portuguese has no case, so the slot decides nothing — "em gramas" is the
    // same word as "2 gramas". Asserted anyway: `selectForm` must answer for a
    // target that has no magnitude to count by (ruling R5).
    expect(
      portuguese.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
    expect(form(1, "conversion-target")).toBe("one");
  });

  test("claims the conversion keywords", () => {
    expect(portuguese.keywords.in).toEqual(["em", "para"]);
    expect(portuguese.keywords.of).toEqual(["de"]);
    expect(portuguese.keywords.over).toEqual(["dividido", "sobre"]);
  });

  /**
   * The one keyword ruling this language does not get to make alone. "por" is
   * `times` and not `by`, because Spanish claims the same surface as `times`
   * and `buildKeywords` throws on two languages disagreeing about one word — so
   * an engine reading Portuguese and Spanish would fail to boot. Pinned here
   * because the pressure to "fix" it is real: "dividido por" is the phrase a
   * Portuguese speaker actually says, and it is the phrase this costs.
   */
  test("por is multiplication, and there is no `by`", () => {
    expect(portuguese.keywords.times).toContain("por");
    expect(portuguese.keywords.by).toBeUndefined();
  });
});

describe("portuguese numerals", () => {
  const read = (words: string[]) => portuguese.numerals?.(words);
  const spell = (n: number) => portuguese.spell?.(new Decimal(n));

  test("reads a run of words, connector and all", () => {
    expect(read(["vinte", "e", "dois"])).toEqual({
      value: new Decimal(22),
      consumed: 3,
    });
    // The connector is grammatically required in Portuguese, but it is still
    // only skipped and never claimed on its own: "cinco e kg" claims one word.
    expect(read(["cinco", "e", "kg"])).toEqual({ value: new Decimal(5), consumed: 1 });
    // Accented and unaccented spellings of the same word — an ASCII keyboard is
    // the ordinary case, not a misspelling.
    expect(read(["três"])).toEqual({ value: new Decimal(3), consumed: 1 });
    expect(read(["tres"])).toEqual({ value: new Decimal(3), consumed: 1 });
    // Feminine agreement, which is a second key on the same value.
    expect(read(["duas"])).toEqual({ value: new Decimal(2), consumed: 1 });
    // Brazil and Portugal spell sixteen differently; both read.
    expect(read(["dezesseis"])).toEqual({ value: new Decimal(16), consumed: 1 });
    expect(read(["dezasseis"])).toEqual({ value: new Decimal(16), consumed: 1 });
    // The hundreds are addends, not multipliers: "duzentos" is one word.
    expect(read(["duzentos", "e", "vinte", "e", "cinco"])?.value).toEqual(
      new Decimal(225),
    );
    // Scales, in the plural form a sentence actually contains.
    expect(read(["dois", "milhões"])?.value).toEqual(new Decimal(2e6));
    // Short scale, which is the Brazilian reading.
    expect(read(["um", "bilhão"])?.value).toEqual(new Decimal(1e9));
  });

  test("spells back through the same table", () => {
    expect(spell(0)).toBe("zero");
    expect(spell(22)).toBe("vinte e dois");
    // "cem" stands alone; "cento" is the form that carries a remainder.
    expect(spell(100)).toBe("cem");
    expect(spell(105)).toBe("cento e cinco");
    expect(spell(155)).toBe("cento e cinquenta e cinco");
    expect(spell(225)).toBe("duzentos e vinte e cinco");
    // "mil", never "um mil" — and "dois milhões", never "dois milhão".
    expect(spell(1000)).toBe("mil");
    expect(spell(2000)).toBe("dois mil");
    expect(spell(1e6)).toBe("um milhão");
    expect(spell(2e6)).toBe("dois milhões");
  });

  test("puts 'e' between classes only where Portuguese does", () => {
    // A tail below one hundred, or a whole number of hundreds, takes the
    // conjunction.
    expect(spell(1005)).toBe("mil e cinco");
    expect(spell(1500)).toBe("mil e quinhentos");
    expect(spell(1100)).toBe("mil e cem");
    expect(spell(1_000_500)).toBe("um milhão e quinhentos");
    expect(spell(1_500_000)).toBe("um milhão e quinhentos mil");
    // A tail that is a number in its own right does not.
    expect(spell(2345)).toBe("dois mil trezentos e quarenta e cinco");
    expect(spell(1_234_567)).toBe(
      "um milhão duzentos e trinta e quatro mil quinhentos e sessenta e sete",
    );
    // Two classes wide, so no conjunction — even though the remainder is a
    // multiple of a hundred. This is the row that makes "the last class
    // decides" different from "the remainder decides".
    expect(spell(1_234_000)).toBe("um milhão duzentos e trinta e quatro mil");
  });

  test("the two directions round-trip, over the same table", () => {
    for (const n of [
      0, 1, 15, 22, 100, 105, 155, 225, 999, 1000, 1005, 1100, 1500, 2345, 100_000, 1e6,
      2e6, 1_000_500, 1_234_000, 1_234_567, 1e9,
    ]) {
      const written = spell(n);
      expect(written).not.toBeNull();
      const words = (written as string).split(" ");
      expect({ n, ...read(words) }).toEqual({
        n,
        value: new Decimal(n),
        consumed: words.length,
      });
    }
  });

  test("declines what the tables cannot say", () => {
    // The same three refusals `cardinalSpeller` makes, for the same reasons:
    // no fractional grammar, no sign, and nothing above 1000 × the largest
    // declared scale.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(portuguese.spell?.(new Decimal("1e15"))).toBeNull();
    expect(portuguese.spell?.(new Decimal("999999999999999"))).not.toBeNull();
  });

  test("every word the speller can reach for is a word the table reads", () => {
    // `COMBINING_HUNDRED` and `SCALE_PLURALS` are the two facts a flat
    // value→word map cannot hold, so they are declared separately — which is
    // exactly the shape that can drift away from the parse table. It cannot
    // drift past this test.
    expect(CARDINALS.tens[COMBINING_HUNDRED]).toBe(100);
    for (const [singular, plural] of Object.entries(SCALE_PLURALS)) {
      expect(CARDINALS.scales[plural]).toBe(CARDINALS.scales[singular] as number);
    }
  });
});

describe("portuguese morphology", () => {
  const analyze = createAnalyzerChain(portuguese);
  const forms = (surface: string) => analyze(surface).map((a) => a.form);

  test("the surface itself is always offered", () => {
    // `identity()` is not decorative: without it the language cannot reach its
    // own aliases at all.
    expect(forms("quilograma")).toContain("quilograma");
    expect(forms("kg")).toContain("kg");
  });

  test("the additive plural is stripped", () => {
    expect(forms("gramas")).toContain("grama");
    expect(forms("metros")).toContain("metro");
    expect(forms("toneladas")).toContain("tonelada");
    expect(forms("colheres")).toContain("colher");
    // The two-letter noun the stem floor is set for.
    expect(forms("pés")).toContain("pé");
  });

  test("a two-letter symbol is never shredded to one letter", () => {
    // "ms" must not become "m": a millisecond is not a metre, and the whole
    // point of a stem floor is that a stripper never hands the resolver a
    // single letter to resolve.
    expect(forms("ms")).not.toContain("m");
    expect(forms("gs")).not.toContain("g");
  });

  test("the rewriting plural is rewritten", () => {
    // The class `suffixStripper` structurally cannot reach.
    expect(forms("galões")).toContain("galão");
    expect(forms("grãos")).toContain("grão");
    expect(forms("barris")).toContain("barril");
    expect(forms("quintais")).toContain("quintal");
    // The Brazilian currency, whose plural is the form every price line is
    // written in.
    expect(forms("reais")).toContain("real");
  });

  test("a rewrite is penalised below an exact reading", () => {
    const exact = analyze("real").find((a) => a.form === "real");
    const rewritten = analyze("reais").find((a) => a.form === "real");
    expect(exact?.weight).toBe(0);
    expect(rewritten?.weight).toBe(-2);
  });
});

/**
 * Gender, which is the one axis Portuguese has that `selectForm` does not carry.
 *
 * A unit noun does not inflect for gender — it *has* one — so `forms` is right
 * to stay a two-row table (rule 6: an axis that is never selected on must not be
 * declared). What does inflect is the numeral standing in front of it, and the
 * only call that sees the spelled numeral and the noun at the same time is
 * `renderQuantity`. These rows are the proof that the seam is enough: no shared
 * type changed, no other language moved, and "um tonelada" became "uma tonelada".
 */
describe("the numeral agrees in gender with the noun it counts", () => {
  const render = (number: string, form: string) =>
    portuguese.renderQuantity?.({
      number,
      form,
      kind: "length",
      unit: "m",
      slot: "after-number",
      gap: " ",
    });

  test.each([
    // Feminine nouns: the two numerals that inflect, and the hundreds.
    ["um", "polegada", "uma polegada"],
    ["um", "hora", "uma hora"],
    ["dois", "toneladas", "duas toneladas"],
    ["vinte e um", "milhas", "vinte e uma milhas"],
    ["cento e um", "milhas", "cento e uma milhas"],
    ["duzentos", "milhas", "duzentas milhas"],
    ["quinhentos", "milhas", "quinhentas milhas"],
    ["novecentos e noventa e nove", "toneladas", "novecentas e noventa e nove toneladas"],
    // Masculine nouns are left exactly as `spellPortuguese` wrote them.
    ["um", "metro", "um metro"],
    ["dois", "metros", "dois metros"],
    ["duzentos", "quilômetros", "duzentos quilômetros"],
    // The invariable numerals, which have no feminine to move to in either
    // gender: only `um`, `dois` and the hundreds from 200 up agree at all.
    ["três", "milhas", "três milhas"],
    ["cem", "milhas", "cem milhas"],
    ["quinze", "horas", "quinze horas"],
    // The -grama class: Greek neuters that kept their masculine, and the
    // commonest gender mistake in the language. "duzentas gramas" is what people
    // say and "duzentos gramas" is what is correct.
    ["duzentos", "gramas", "duzentos gramas"],
    ["um", "grama", "um grama"],
    ["um", "quilograma", "um quilograma"],
    ["dois", "miligramas", "dois miligramas"],
    // `dia` is masculine despite the -a, and nothing else in the repo is: it
    // scans identically to "caloria", which is feminine.
    ["um", "dia", "um dia"],
    ["dois", "dias", "dois dias"],
    ["um", "caloria", "uma caloria"],
  ])("%s + %s -> %s", (number, form, expected) => {
    expect(render(number, form)).toBe(expected);
  });

  test.each([
    // `milhão` and `bilhão` are masculine nouns, so what counts *them* stays
    // masculine while what counts the unit agrees. `mil` is not a noun and
    // agreement passes straight through it — which is the whole reason the
    // rewrite works on the tail after the last scale noun rather than on the
    // last word.
    ["duzentos mil", "milhas", "duzentas mil milhas"],
    ["mil e quinhentos", "milhas", "mil e quinhentas milhas"],
    // Masculine, because the hundreds here count `milhões` and not `milhas` —
    // and "de" besides, from the rule below.
    ["duzentos milhões", "milhas", "duzentos milhões de milhas"],
    ["um milhão e quinhentos mil", "milhas", "um milhão e quinhentas mil milhas"],
  ])("%s + %s -> %s", (number, form, expected) => {
    expect(render(number, form)).toBe(expected);
  });

  test("a scale noun at the end takes its complement", () => {
    // "um milhão de gramas", never *"um milhão gramas": `milhão` is a noun and
    // what follows it is a complement. The preposition drops the moment a
    // remainder makes the number a quantifier again, which the row above pins.
    expect(render("um milhão", "gramas")).toBe("um milhão de gramas");
    expect(render("dois milhões", "toneladas")).toBe("dois milhões de toneladas");
    // `mil` is a quantifier and never takes it.
    expect(render("dois mil", "gramas")).toBe("dois mil gramas");
  });

  test("a digit string and a symbol are untouched, byte for byte", () => {
    // The rewrite is only reachable through `Printer`'s spelled mode: a digit
    // string contains no key of the agreement table, and a unit rendered through
    // its symbol has no noun for the numeral to agree with.
    expect(render("1,5", "quilograma")).toBe("1,5 quilograma");
    expect(render("1.234.567", "milhas")).toBe("1.234.567 milhas");
    expect(
      portuguese.renderQuantity?.({
        number: "1,5",
        symbol: "kg",
        kind: "mass",
        unit: "kg",
        slot: "after-number",
      }),
    ).toBe("1,5kg");
  });

  test("every feminine the renderer can write is a word the table reads", () => {
    // Rule 5, applied to a numeral: this language may print nothing `CARDINALS`
    // cannot read back. Without this, "duzentas milhas" would be output that the
    // engine's own numeral parser refuses.
    const read = (word: string) => portuguese.numerals?.([word]);
    for (const [masculine, feminine] of [
      ["um", "uma"],
      ["dois", "duas"],
      ["duzentos", "duzentas"],
      ["trezentos", "trezentas"],
      ["quatrocentos", "quatrocentas"],
      ["quinhentos", "quinhentas"],
      ["seiscentos", "seiscentas"],
      ["setecentos", "setecentas"],
      ["oitocentos", "oitocentas"],
      ["novecentos", "novecentas"],
    ]) {
      // Read back at all, and read back as the *same* number the masculine
      // spelling does — a feminine that resolved to a different value would be
      // worse than one that resolved to none.
      expect({ feminine, ...read(feminine as string) }).toEqual({
        feminine,
        value: read(masculine as string)?.value as Decimal,
        consumed: 1,
      });
    }
  });
});
