import type { Elem, ElemCase, Shape } from "./base.js";

// Shape-vs-Shape matching. Independent of any wiring pattern.

// Single-direction: Actual must extend In. Elem is closed — a new arm must
// not classify to a subtype of an existing one. Both sides go through the
// canonical ElemCase; the continuation branches off its fields. A bare InE
// (branch and variants both never) claims only dim+kind, so any
// same-dim+kind ActualE satisfies it; a declared InE compares its payload
// arm (branch xor variants — never-guarded both sides, since bare never
// matches everything).
type MatchElem<InE extends Elem, ActualE extends Elem> =
  ElemCase<InE> extends {
    dim: infer IDim;
    kind: infer IKind;
    branch: infer IBr;
    variants: infer IV;
  }
    ? ElemCase<ActualE> extends {
        dim: infer ADim;
        kind: infer AKind;
        branch: infer ABr;
        variants: infer AV;
      }
      ? ADim extends IDim
        ? AKind extends IKind
          ? [IBr] extends [never]
            ? [IV] extends [never]
              ? true
              : [AV] extends [never]
                ? false
                : AV extends IV
                  ? true
                  : false
            : [ABr] extends [never]
              ? false
              : ABr extends IBr
                ? true
                : false
          : false
        : false
      : false
    : false;

// "..." isn't an Elem, so its check precedes the Head/Tail destructure.
export type MatchShape<In extends Shape, Actual extends Shape> = In extends []
  ? Actual extends []
    ? true
    : false
  : In extends ["..."]
    ? true
    : [In, Actual] extends [
          [infer InHead extends Elem, ...infer InTail extends Shape],
          [infer AHead extends Elem, ...infer ATail extends Shape],
        ]
      ? MatchElem<InHead, AHead> extends true
        ? MatchShape<InTail, ATail>
        : false
      : false;

// Narrowing gate: the Shape-side counterpart of CheckData (which narrows
// Shape×Data). Returns the matched Shape for callers that keep it.
export type CheckShape<In extends Shape, Actual extends Shape> =
  MatchShape<In, Actual> extends true ? Actual : never;
