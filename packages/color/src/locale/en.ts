import { notationVocabulary } from "./shared";

/**
 * English, and the file every other locale here is measured against.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("en", {
  hex: ["hexcode"],
  hexForms: { one: "hex", other: "hex" },
  name: ["colorname", "colourname"],
  nameForms: { one: "name", other: "names" },
  cues: {
    color: 3,
    colour: 3,
    colors: 3,
    colours: 3,
    hue: 2,
    shade: 2,
    tint: 2,
    swatch: 3,
    palette: 2,
    paint: 2,
    background: 1,
    foreground: 1,
  },
});
