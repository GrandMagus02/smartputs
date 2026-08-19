import { notationVocabulary } from "./shared";

/**
 * Polish. `barwa` and `kolor` are both current; neither is a unit alias, so both are cues.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("pl", {
  hexForms: { one: "hex", other: "hex" },
  name: ["nazwa"],
  nameForms: { one: "nazwa", other: "nazwy" },
  cues: {
    kolor: 3,
    kolory: 3,
    barwa: 2,
    odcień: 2,
    paleta: 2,
    tło: 1,
  },
});
