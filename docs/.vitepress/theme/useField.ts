import type { Parsed } from "@smartput/shared";
import { type ComputedRef, computed, type Ref, ref, useId } from "vue";
import { type FieldKind, messageFor } from "./validation";

export interface FieldOptions {
  /** The kind this field accepts. */
  kind: Ref<FieldKind> | ComputedRef<FieldKind>;
  /** The bound text. Owned by the caller, so a form can reset it. */
  value: Ref<string>;
  /**
   * When the message is allowed to appear. Default `"blur"`.
   *
   * `"input"` shouts "not a number" at someone who has typed the first
   * character of one. `"blur"` waits until they have left the field once, and
   * from then on updates live — which is the behaviour people read as
   * responsive rather than impatient.
   */
  when?: "input" | "blur";
  /** Treat an empty field as an error rather than as "not filled in yet". */
  required?: boolean;
}

export interface Field {
  /** The last parse. `ok: false` carries the `code`, never a message. */
  parsed: ComputedRef<Parsed<string>>;
  /** True once the value parses. Empty and optional counts as valid. */
  valid: ComputedRef<boolean>;
  /** The sentence to show, or `null` — respects `when` and `touched`. */
  message: ComputedRef<string | null>;
  touched: Ref<boolean>;
  /** Spread onto the `<input>`: id, aria-invalid, aria-describedby, @blur. */
  inputProps: ComputedRef<Record<string, unknown>>;
  /** Spread onto the `<label>`. */
  labelProps: ComputedRef<{ for: string }>;
  /** Ids the field owns, for wiring a description and an error region. */
  ids: { input: string; error: string; hint: string };
  /** Call before submitting: marks touched so a pristine field can still fail. */
  markTouched: () => void;
}

/**
 * One field's validation state and its accessibility wiring, from a `parseX`.
 *
 * The wiring is the part worth extracting. `aria-invalid` and a live
 * `aria-describedby` that points at the error only while there is an error are
 * what make the red border mean something to a screen reader, and they are also
 * the two lines everyone forgets — so they live here rather than in each
 * template.
 */
export function useField(opts: FieldOptions): Field {
  const when = opts.when ?? "blur";
  const required = opts.required ?? false;
  const touched = ref(false);

  const base = useId();
  const ids = {
    input: `${base}-input`,
    error: `${base}-error`,
    hint: `${base}-hint`,
  };

  const parsed = computed(() => opts.kind.value.parse(opts.value.value));

  const valid = computed(() => {
    if (parsed.value.ok) return true;
    return !required && parsed.value.code === "empty";
  });

  const message = computed(() => {
    if (valid.value) return null;
    if (when === "blur" && !touched.value) return null;
    return messageFor(opts.kind.value, parsed.value);
  });

  const inputProps = computed(() => ({
    id: ids.input,
    "aria-invalid": message.value !== null ? "true" : undefined,
    // Both ids only when both regions are rendered; a dangling id reference is
    // announced as nothing at all by some screen readers rather than skipped.
    "aria-describedby": message.value !== null ? `${ids.error} ${ids.hint}` : ids.hint,
    onBlur: () => {
      touched.value = true;
    },
  }));

  const labelProps = computed(() => ({ for: ids.input }));

  return {
    parsed,
    valid,
    message,
    touched,
    inputProps,
    labelProps,
    ids,
    markTouched: () => {
      touched.value = true;
    },
  };
}
