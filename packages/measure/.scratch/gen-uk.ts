/**
 * Regenerates `packages/measure/corpus/uk.tsv`. Same rule as
 * `packages/kinds/.scratch/gen-uk.ts`: the inputs and comments are written by
 * hand, the three answer columns are read off the engine because a Ukrainian
 * string carries U+00A0 and a decimal comma that cannot be retyped reliably,
 * and every generated row was read before it landed.
 *
 * ```sh
 * bun run packages/measure/.scratch/gen-uk.ts
 * ```
 */
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { number } from "@smartput/number";
import numberUk from "@smartput/number/locale/uk";
import { measure } from "../src/index";
import measureUk from "../src/locale/uk";

const engine = createEngine({
  locales: [composeLocale(uk, [numberUk, measureUk])],
  kinds: [number, measure],
});

const LINES: string[] = [
  "# input\tkind\tcanonical\tformatted",
  "1 дюйм в пунктах",
  "72 пункти в дюймах",
  "6 пік в дюймах",
  "1 дюйм в мм",
  "25,4 мм в дюймах",
  "1 дюйм в пікселях",
  "96 пікселів в дюймах",
  "2 дюйми + 36 пунктів",
  "1 дюйм - 12 пунктів",
  "3 дюйми * 2",
  "1 дюйм / 4",
  "-2 дюйми",
  "1 піка в пунктах",
  "10 мм в см",
  "один дюйм",
  "# Three paradigms, not one applied three times. `пункт` is a hard-stem",
  "# masculine and `піксель` a soft-stem one, so their plurals differ by a",
  "# letter; `піка` is feminine, so its nominative plural and genitive singular",
  "# coincide and its genitive plural is the bare stem.",
  "21 пункт",
  "11 пунктів",
  "2 пункти",
  "2 пікселі",
  "5 пікселів",
  "2 піки",
  "5 пік",
  "# Latin aliases still read on a Ukrainian engine — a designer types `pt`",
  "# whatever the keyboard is — and the printed symbol for the three",
  "# typographic units stays Latin because that is what gets written.",
  "72 pt в дюймах",
  "96 px в дюймах",
];

const out: string[] = [];
for (const line of LINES) {
  if (line.startsWith("#")) {
    out.push(line);
    continue;
  }
  const r = engine.evaluate(line);
  out.push([line, r.kind, r.value.canonical.toString(), r.formatted].join("\t"));
}
await Bun.write(new URL("../corpus/uk.tsv", import.meta.url), `${out.join("\n")}\n`);
