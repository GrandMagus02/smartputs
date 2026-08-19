import { notationVocabulary } from "./shared";

/**
 * French. `teinte` and `nuance` are both hue-ish words that argue for a colour without naming one.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("fr", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nom"],
  nameForms: { one: "nom", other: "noms" },
  cues: {
    couleur: 3,
    couleurs: 3,
    teinte: 2,
    nuance: 2,
    palette: 2,
    fond: 1,
  },
});
