import type { Completion, Engine } from "@smartput/core";
import { computed, type Ref, ref, watch } from "vue";

export interface CompletionsOptions {
  engine: Engine;
  input: Ref<string>;
  /** Rows to keep after ranking. Default 6 — a dropdown, not a catalogue. */
  limit?: number;
  /**
   * Drop the row that would rewrite the input to itself. Default true.
   *
   * A finished word is still a prefix of itself, so `complete("30 hours")`
   * legitimately offers `hours` back. That is right for the API — the caller
   * asked which units match — and wrong for a dropdown, where the row does
   * nothing when accepted.
   */
  hideExact?: boolean;
}

export interface Completions {
  rows: Ref<Completion[]>;
  /** How many rows `hideExact` dropped — see the computed below. */
  suppressed: Ref<number>;
  /** Rows exist *and* the list has not been dismissed for this exact input. */
  open: Ref<boolean>;
  active: Ref<number>;
  /** Rewrites the input to `row.text` and closes the list. */
  accept: (row: Completion) => void;
  /** Closes the list until the input changes again. */
  dismiss: () => void;
  /** Returns true when it consumed the key, so the caller can preventDefault. */
  onKeydown: (event: KeyboardEvent) => boolean;
}

/**
 * The keyboard behaviour every completion surface on this site shares: ↓/↑ to
 * move, Enter or Tab to accept, Escape to dismiss.
 *
 * `engine.complete()` is synchronous and allocation-light, so this recomputes
 * on every keystroke rather than debouncing — which is the claim the library
 * makes about itself, and a demo that quietly debounced would be evidence of
 * the opposite.
 */
export function useCompletions(opts: CompletionsOptions): Completions {
  const limit = opts.limit ?? 6;
  const hideExact = opts.hideExact ?? true;

  const found = computed<Completion[]>(() =>
    opts.input.value.trim() === ""
      ? []
      : opts.engine.complete(opts.input.value, { limit }),
  );

  const rows = computed<Completion[]>(() =>
    hideExact ? found.value.filter((row) => row.text !== opts.input.value) : found.value,
  );

  // Non-zero only when the engine had answers and every one of them would
  // rewrite the input to itself — the "the word is already finished" case,
  // which reads differently to the caller than "there is nothing here to
  // complete" and so is worth telling apart.
  const suppressed = computed(() => found.value.length - rows.value.length);

  // The input the list was dismissed for. Comparing against the current input
  // — rather than holding a bare boolean — is what makes Escape stick until the
  // user actually types something new, while accepting a row does not
  // immediately re-open the list on the text it just inserted.
  const dismissedFor = ref<string | null>(null);
  const active = ref(0);

  watch(rows, () => {
    active.value = 0;
  });

  const open = computed({
    get: () => rows.value.length > 0 && dismissedFor.value !== opts.input.value,
    set: (value: boolean) => {
      dismissedFor.value = value ? null : opts.input.value;
    },
  });

  function dismiss(): void {
    dismissedFor.value = opts.input.value;
  }

  function accept(row: Completion): void {
    opts.input.value = row.text;
    dismissedFor.value = row.text;
  }

  function onKeydown(event: KeyboardEvent): boolean {
    if (!open.value) return false;

    if (event.key === "ArrowDown") {
      active.value = (active.value + 1) % rows.value.length;
      return true;
    }
    if (event.key === "ArrowUp") {
      active.value = (active.value - 1 + rows.value.length) % rows.value.length;
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const row = rows.value[active.value];
      if (row === undefined) return false;
      accept(row);
      return true;
    }
    if (event.key === "Escape") {
      dismiss();
      return true;
    }
    return false;
  }

  return { rows, suppressed, open, active, accept, dismiss, onKeydown };
}
