import { notationVocabulary } from "./shared";

/**
 * German. `Farbe` is the cue that matters; `Farbton` argues for a colour too, but weakly, since it is also this package's word for a hue channel.
 *
 * The CSS notation names are not translated — see `shared.ts` for why. What
 * this file carries is the part that genuinely differs: the word for a hex
 * code, the word for a colour's name, and the cues.
 */
export default notationVocabulary("de", {
  hex: ["hexcode"],
  hexForms: { one: "Hex", other: "Hex" },
  name: ["farbname"],
  nameForms: { one: "Name", other: "Namen" },
  cues: {
    farbe: 3,
    farben: 3,
    farbton: 2,
    farbwert: 3,
    palette: 2,
    schattierung: 2,
    hintergrund: 1,
    vordergrund: 1,
  },
});
