import { add, as, format, scale, sub } from "../src/ops";
import { parse } from "../src/parse";
import type { UnitTable } from "../src/types";

const LENGTH: UnitTable<"mm" | "cm" | "m" | "km" | "in" | "ft"> = {
  canonical: "m",
  ratio: { mm: "0.001", cm: "0.01", m: "1", km: "1000", in: "0.0254", ft: "0.3048" },
  alias: {
    mm: "mm",
    millimetre: "mm",
    millimetres: "mm",
    cm: "cm",
    centimetre: "cm",
    centimetres: "cm",
    m: "m",
    metre: "m",
    metres: "m",
    km: "km",
    kilometre: "km",
    kilometres: "km",
    in: "in",
    inch: "in",
    inches: "in",
    ft: "ft",
    foot: "ft",
    feet: "ft",
  },
};

type Row = [string, string, string];
const ROWS: Row[] = [
  // parse, loose
  ["parse", "loose", "10 km"],
  ["parse", "loose", "10km"],
  ["parse", "loose", "  10 km  "],
  ["parse", "loose", "1.5 metres"],
  ["parse", "loose", "-5km"],
  ["parse", "loose", "1e3 m"],
  ["parse", "loose", "12 inches"],
  ["parse", "loose", "km"],
  ["parse", "loose", "10"],
  ["parse", "loose", ""],
  ["parse", "loose", "   "],
  ["parse", "loose", "10 furlongs"],
  ["parse", "loose", "smth"],
  ["parse", "loose", "30,5km"],
  // parse, strict — what `format` emits, and nothing else
  ["parse", "strict", "10km"],
  ["parse", "strict", "10 km"],
  ["parse", "strict", "  10km"],
  ["parse", "strict", "km"],
  ["parse", "strict", "10"],
  // the free ops, written as an expression the row can name
  ["add", "loose", "1 km + 500 m"],
  ["add", "loose", "30cm + 30cm"],
  ["sub", "loose", "1 km - 250 m"],
  ["sub", "loose", "2m - 2m"],
  ["scale", "loose", "10 km * 3"],
  ["scale", "loose", "1 km * 0.25"],
  ["as", "loose", "2 km in m"],
  ["as", "loose", "1 ft in cm"],
  ["as", "loose", "12 inch in cm"],
  ["as", "loose", "1500 mm in m"],
];

const emit = (row: Row, outcome: string, unit: string, value: string, text: string) =>
  console.log(`${row[2]}\t${row[0]}\t${row[1]}\t${outcome}\t${unit}\t${value}\t${text}`);

for (const row of ROWS) {
  const [op, mode, input] = row;
  const opts = { mode: mode as "strict" | "loose" };

  if (op === "parse") {
    const p = parse(LENGTH, input, opts);
    if (!p.ok) {
      emit(row, p.code, "-", "-", "-");
      continue;
    }
    emit(row, "ok", p.unit, String(p.value), format(LENGTH, p));
    continue;
  }

  // The expression forms. Split on the operator the row's op names.
  let result: ReturnType<typeof add<"mm" | "cm" | "m" | "km" | "in" | "ft">> | undefined;
  if (op === "add") {
    const [l, r] = input.split(" + ");
    result = add(LENGTH, l as string, r as string, opts);
  } else if (op === "sub") {
    const [l, r] = input.split(" - ");
    result = sub(LENGTH, l as string, r as string, opts);
  } else if (op === "scale") {
    const [l, r] = input.split(" * ");
    result = scale(LENGTH, l as string, Number(r), opts);
  } else if (op === "as") {
    const [l, r] = input.split(" in ");
    result = as(LENGTH, l as string, r as never, opts);
  }
  if (result === undefined) throw new Error(`no op ${op}`);
  if (!result.ok) {
    emit(row, result.code, "-", "-", "-");
    continue;
  }
  emit(row, "ok", result.unit, String(result.value), format(LENGTH, result));
}
