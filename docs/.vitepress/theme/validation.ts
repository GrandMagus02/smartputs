import {
  ANGLE_UNITS,
  AREA_UNITS,
  DATARATE_UNITS,
  DATASIZE_UNITS,
  DURATION_UNITS,
  ENERGY_UNITS,
  LENGTH_UNITS,
  MASS_UNITS,
  MEASURE_UNITS,
  NUMBER_UNITS,
  PERCENT_UNITS,
  POWER_UNITS,
  parseAngle,
  parseArea,
  parseDatarate,
  parseDatasize,
  parseDuration,
  parseEnergy,
  parseLength,
  parseMass,
  parseMeasure,
  parseNumber,
  parsePercent,
  parsePower,
  parseSpeed,
  parseTempDelta,
  parseTemperature,
  parseTempo,
  parseVolume,
  SPEED_UNITS,
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  TEMPO_UNITS,
  VOLUME_UNITS,
} from "@smartput/kinds/validate";
import type { ErrCode, Parsed, UnitTable } from "@smartput/shared";

/**
 * The demo site imports the barrel; a real form should import the one subpath
 * it needs — `@smartput/length/validate` is 1.5 KB and shakes to nothing else,
 * while this file deliberately holds every ratio kind at once so a page can name
 * its own and the switchable demo can offer all of them.
 */
export interface FieldKind {
  /** The kind id, as the engine spells it. */
  readonly id: string;
  /** What the label says. */
  readonly label: string;
  /** Free-function door: `Ok | Err`, never a throw. */
  readonly parse: (input: string) => Parsed<string>;
  /** Its unit table, for listing what the field accepts. */
  readonly table: UnitTable<string>;
  /** A value the field is happy with, for the placeholder. */
  readonly example: string;
}

const kind = <U extends string>(
  id: string,
  label: string,
  parse: (input: string) => Parsed<U>,
  table: UnitTable<U>,
  example: string,
): FieldKind => ({
  id,
  label,
  parse: parse as (input: string) => Parsed<string>,
  table: table as UnitTable<string>,
  example,
});

/**
 * Every ratio kind the repo ships, so a package page can name its own and the
 * switchable demo can offer all of them. `tempdelta` is here as its own entry
 * rather than folded into `temperature`: they are two kinds, and a field that
 * accepts one must reject the other.
 */
export const FIELD_KINDS: readonly FieldKind[] = [
  kind("length", "Length", parseLength, LENGTH_UNITS, "12 cm"),
  kind("mass", "Mass", parseMass, MASS_UNITS, "500 g"),
  kind("duration", "Duration", parseDuration, DURATION_UNITS, "90 min"),
  kind("angle", "Angle", parseAngle, ANGLE_UNITS, "30 deg"),
  kind("area", "Area", parseArea, AREA_UNITS, "40 m2"),
  kind("volume", "Volume", parseVolume, VOLUME_UNITS, "1.5 l"),
  kind("speed", "Speed", parseSpeed, SPEED_UNITS, "80 kph"),
  kind("datasize", "Data size", parseDatasize, DATASIZE_UNITS, "256 MB"),
  kind("datarate", "Data rate", parseDatarate, DATARATE_UNITS, "100 mbps"),
  kind("energy", "Energy", parseEnergy, ENERGY_UNITS, "2 kWh"),
  kind("power", "Power", parsePower, POWER_UNITS, "750 W"),
  kind("tempo", "Tempo", parseTempo, TEMPO_UNITS, "120 bpm"),
  kind("temperature", "Temperature", parseTemperature, TEMPERATURE_UNITS, "21 °C"),
  kind("tempdelta", "Temperature difference", parseTempDelta, TEMPDELTA_UNITS, "5 °C"),
  kind("measure", "Typographic measure", parseMeasure, MEASURE_UNITS, "12 pt"),
  kind("number", "Number", parseNumber, NUMBER_UNITS, "42"),
  kind("percent", "Percent", parsePercent, PERCENT_UNITS, "20%"),
];

export function fieldKind(id: string): FieldKind {
  const found = FIELD_KINDS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no demo field kind ${JSON.stringify(id)}`);
  return found;
}

/** Every unit key of a table, canonical first — the order a hint should read in. */
export function unitKeys(table: UnitTable<string>): string[] {
  const keys = Object.keys(table.ratio);
  return [table.canonical, ...keys.filter((key) => key !== table.canonical)];
}

/**
 * The six codes `parse` can return, as sentences a person can act on.
 *
 * The library returns a code and the offending input, never a message: a
 * message is a product decision (tone, language, how much of the unit list to
 * spell out) and shipping one would make the 1.3 KB budget carry a copywriting
 * opinion. This map is that decision, made once, in the app.
 */
export type FieldMessages = Readonly<Record<ErrCode, string>>;

export function messagesFor(field: FieldKind): FieldMessages {
  const units = unitKeys(field.table);
  const shown = units.slice(0, 4).join(", ");
  const rest = units.length > 4 ? `, … (${units.length} in total)` : "";
  return {
    empty: `Enter a ${field.label.toLowerCase()}, for example ${field.example}.`,
    // Not "start with a number": a bare unit parses as one of that unit, so
    // `cm` is valid and `cm12` is what actually lands here.
    nan: `That is not a number — try ${field.example}.`,
    "missing-unit": `Add a unit: ${shown}${rest}.`,
    "unknown-unit": `That unit is not a ${field.label.toLowerCase()}. Try ${shown}${rest}.`,
    "wrong-unit": `This field only accepts one unit.`,
    trailing: `Remove the text after the unit — one number and one unit is all this reads.`,
  };
}

/** The sentence for a failed parse, or `null` while the value is good. */
export function messageFor(field: FieldKind, parsed: Parsed<string>): string | null {
  if (parsed.ok) return null;
  return messagesFor(field)[parsed.code];
}
