const DASHES = /[−‒–—―]/g;
const ZERO_WIDTH = /(​|‌|‍|﻿)/g;
const DEGREE = /°/g;
const WHITESPACE = /\s+/g;

export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(DASHES, "-")
    .replace(DEGREE, "")
    .replace(WHITESPACE, " ")
    .trim();
}
