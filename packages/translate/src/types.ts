/**
 * The shape every provider hands back. Kept apart from the providers
 * themselves so the root barrel — and `Translator`, which only needs the
 * shape, never a fetch call — links no network code (design §5).
 */
export interface TranslateResult {
  readonly text: string;
  readonly source: string;
  readonly target: string;
  readonly provider: string;
}

/** The contract every `./providers` factory returns (design §5). */
export interface TranslateProvider {
  readonly id: string;
  translate(text: string, target: string, source?: string): Promise<TranslateResult>;
}

/** One row of the ISO 639-1 table in `./languages` (design §3). */
export interface LanguageDef {
  readonly code: string;
  readonly name: string;
  readonly aliases?: readonly string[];
}

/** What `parseLiteral` in `./literal` returns (design §4). */
export interface TranslateLiteral {
  readonly text: string;
  readonly target: string;
  readonly source?: string;
}
