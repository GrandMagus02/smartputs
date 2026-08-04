import { DimensionMismatchError, TooAmbiguousError } from "../errors";
import { NUMBER_KIND, opKey, type Registry } from "../kind/registry";
import type { Node } from "../parse/ast";
import { walk } from "../parse/ast";
import type { Candidate, KindId } from "../types";

export const CONTEXT_BONUS = 30;

export interface Assignment {
  choices: Map<Node, Candidate>;
  kind: KindId;
  score: number;
  /** The part of `score` that came from context agreement, so explain() can list it. */
  contextBonus: number;
  confidence: number;
}

interface Slot {
  node: Node;
  candidates: Candidate[];
}

function collectSlots(root: Node, kinds: KindId[] | undefined): Slot[] {
  const slots: Slot[] = [];
  walk(root, (node) => {
    if (node.type === "quantity") {
      const filtered =
        kinds === undefined
          ? node.candidates
          : node.candidates.filter((c) => kinds.includes(c.kind));
      slots.push({ node, candidates: filtered });
    } else if (node.type === "convert") {
      const filtered =
        kinds === undefined
          ? node.target
          : node.target.filter((c) => kinds.includes(c.kind));
      slots.push({ node, candidates: filtered });
    }
  });
  return slots;
}

/** Returns the kind of `node` under `choices`, or null when no op signature applies. */
function typeOf(
  node: Node,
  choices: Map<Node, Candidate>,
  registry: Registry,
): KindId | null {
  switch (node.type) {
    case "number":
      return NUMBER_KIND;
    case "quantity":
      return choices.get(node)?.kind ?? null;
    case "unary":
      return typeOf(node.operand, choices, registry);
    case "convert": {
      const operand = typeOf(node.operand, choices, registry);
      const target = choices.get(node);
      if (operand === null || target === undefined) return null;
      // Take the result from the signature rather than assuming it is the
      // target's own kind: the signature is already in hand, and a declared
      // cross-kind `in` need not be an identity on kind.
      return registry.ops.get(opKey("in", operand, target.kind))?.result ?? null;
    }
    case "binary": {
      const left = typeOf(node.left, choices, registry);
      const right = typeOf(node.right, choices, registry);
      if (left === null || right === null) return null;
      return registry.ops.get(opKey(node.op, left, right))?.result ?? null;
    }
  }
}

function contextBonus(
  node: Node,
  choices: Map<Node, Candidate>,
  registry: Registry,
): number {
  let bonus = 0;
  walk(node, (n) => {
    if (n.type !== "binary") return;
    const left = typeOf(n.left, choices, registry);
    const right = typeOf(n.right, choices, registry);
    if (left !== null && left === right && left !== NUMBER_KIND) bonus += CONTEXT_BONUS;
  });
  return bonus;
}

function softmax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

export function solve(
  root: Node,
  registry: Registry,
  opts: { maxCandidates: number; kinds?: KindId[]; input: string },
): Assignment[] {
  const slots = collectSlots(root, opts.kinds);

  const space = slots.reduce((n, s) => n * Math.max(s.candidates.length, 1), 1);
  if (space > opts.maxCandidates) {
    throw new TooAmbiguousError(opts.input, space, opts.maxCandidates);
  }

  const viable: Array<{
    choices: Map<Node, Candidate>;
    kind: KindId;
    score: number;
    contextBonus: number;
  }> = [];

  const enumerate = (
    index: number,
    choices: Map<Node, Candidate>,
    weight: number,
  ): void => {
    if (index === slots.length) {
      const kind = typeOf(root, choices, registry);
      if (kind === null) return;
      const bonus = contextBonus(root, choices, registry);
      viable.push({
        choices: new Map(choices),
        kind,
        score: weight + bonus,
        contextBonus: bonus,
      });
      return;
    }
    const slot = slots[index];
    if (slot === undefined) return;
    for (const candidate of slot.candidates) {
      choices.set(slot.node, candidate);
      enumerate(index + 1, choices, weight + candidate.weight);
      choices.delete(slot.node);
    }
  };

  enumerate(0, new Map(), 0);

  if (viable.length === 0) {
    const first = slots[0]?.candidates[0]?.kind ?? "unknown";
    const second = slots[1]?.candidates[0]?.kind ?? "unknown";
    throw new DimensionMismatchError(opts.input, "operation", first, second);
  }

  viable.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      [...a.choices.values()]
        .map((c) => c.unit)
        .join()
        .localeCompare([...b.choices.values()].map((c) => c.unit).join()),
  );

  const confidences = softmax(viable.map((v) => v.score));
  return viable.map((v, i) => ({ ...v, confidence: confidences[i] ?? 0 }));
}
