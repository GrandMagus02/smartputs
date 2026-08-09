/**
 * Regenerates the parity fixtures. Run deliberately, never automatically: a
 * fixture that re-records itself proves nothing, and the whole value of these
 * files is that changing an output produces a diff a reviewer has to approve.
 *
 * Two languages, two fixtures, one `record`. English is the frozen one — its
 * fixture has not moved across five phases of the i18n work and a diff in it
 * is a regression until proven otherwise. Ukrainian's is younger and will move
 * when its vocabularies are corrected; what it pins is that a correction is
 * *seen*, not that it never happens.
 */
import { createEngine } from "../packages/core/src/engine";
import { composeLocale } from "../packages/core/src/locale/compose";
import { english as en } from "../packages/core/src/locale/en";
import { ukrainian as uk } from "../packages/core/src/locale/uk";
import { INPUTS, record, UK_INPUTS } from "../packages/core/src/parity";
// Relative, not `@smartput/kinds`: workspace packages are linked into each
// package's own `node_modules` and not into the root one, so a bare specifier
// resolves from inside `packages/` and fails from here. Core was already
// reached this way; kinds was reached by package name, which is why
// `bun run parity:record` could not run at all until this was noticed.
import { BUILTIN_KINDS } from "../packages/kinds/src/index";
import BUILTIN_EN from "../packages/kinds/src/locale/en";
import BUILTIN_UK from "../packages/kinds/src/locale/uk";

const LANGUAGES = [
  {
    id: "en",
    engine: createEngine({
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: BUILTIN_KINDS,
    }),
    inputs: INPUTS,
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, BUILTIN_UK)],
      kinds: BUILTIN_KINDS,
    }),
    inputs: UK_INPUTS,
  },
];

for (const { id, engine, inputs } of LANGUAGES) {
  const target = new URL(`../packages/core/parity/${id}.json`, import.meta.url);
  await Bun.write(target, `${JSON.stringify(record(engine, inputs), null, 2)}\n`);
  console.log(`wrote ${target.pathname} (${inputs.length} inputs)`);
}
