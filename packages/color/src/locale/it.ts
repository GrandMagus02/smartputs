import { notationVocabulary } from "./shared";

/**
 * Italian. `tinta` is paint as much as colour, which is exactly the sense a cue wants.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("it", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nome"],
  nameForms: { one: "nome", other: "nomi" },
  cues: {
    colore: 3,
    colori: 3,
    tonalità: 2,
    tinta: 2,
    tavolozza: 2,
    sfondo: 1,
  },
});
