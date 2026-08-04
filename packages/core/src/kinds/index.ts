import type { Kind } from "../types";
import { duration } from "./duration";
import { length } from "./length";
import { mass } from "./mass";
import { number } from "./number";

export { duration, length, mass, number };

export const BUILTIN_KINDS: Kind[] = [number, length, mass, duration];
