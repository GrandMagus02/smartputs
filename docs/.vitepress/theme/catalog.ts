import { PACKAGE_CATALOG } from "./packages-catalog";

/**
 * One card. `example` is what a person would type into the thing the card
 * links to — an expression for a kind package, a call for a package with no
 * expression to type, a recipe's own input on the examples index.
 */
export interface CatalogItem {
  readonly title: string;
  readonly summary: string;
  readonly link: string;
  readonly example?: string;
  /** A UnoCSS icon class, e.g. `i-hugeicons-ruler`. */
  readonly icon?: string;
}

export interface CatalogGroup {
  readonly group: string;
  readonly items: readonly CatalogItem[];
}

/**
 * The rows of one group of the generated package catalog.
 *
 * An unknown group is an empty grid rather than a throw: the group names come
 * from `GROUP_ORDER` in `scripts/gen-package-pages.ts` and are written into the
 * generated Markdown by the same run that writes the data, so the two cannot
 * disagree — but a hand-edited page that misspells one should lose its cards,
 * not the build.
 */
export function catalogGroup(group: string): CatalogItem[] {
  return [...(PACKAGE_CATALOG.find((row) => row.group === group)?.items ?? [])];
}

export { PACKAGE_CATALOG };
