---
name: redesign-p1-fear-greed-score-coercion-r3
description: kindServerRegistry.ts fear-greed score coercion R3 exhaustive edge-case audit — approved, no third defect found
metadata:
  type: project
---

R2 found real bug #2 in [[redesign-p1-heading-section-r2]] lineage: `typeof r.score === 'string' ? Number(r.score) : r.score`
turned `''`/`'   '` into `0` (Number('')===0, Number.isFinite(0)===true), fabricating "공포·탐욕 지수 0" for blank
scores. Fixed with `r.score.trim() !== ''` guard before `Number()`.

R3 asked for an exhaustive third-defect hunt across the coercion path. Traced all of:
`'0'`, `'0.0'`, `0`, `-0`, `'-5'`, `'1e3'`, `'0x10'`, `' 42 '`, `'42abc'`, `true`, `[]`, `[42]`, `{}`,
`{valueOf(){return 42}}`, boxed `Number` object — every case is safe. Only `typeof === 'string'` values get
`Number()`-coerced; everything else (boolean/array/object/boxed-Number) stays non-number typeof and falls
through to the no-number fallback string (info lost, never lied). Numeric strings that parse to a real
finite number (including hex `'0x10'`→16, exponential `'1e3'`→1000, negative `'-5'`) render faithfully —
not a coercion bug, since `result` is jsonb (JSON round-tripped), so functions/Symbols/boxed-object shapes
like `{valueOf(){...}}` can't actually arrive at runtime regardless of the `Record<string, unknown>` type.
Range validation (is 1000 or -5 a *legitimate* fear-greed score) is a writer/computation-layer concern
(siglens-core), not this render-time formatter's job — DOMAIN.md has no fear-greed score-range section to
contradict that. Verified `Number('1e3')`, `Number('0x10')`, `typeof new Number(42)`, `-0` template-literal
stringification (`${-0}` → `"0"`) live via `node -e`, and re-ran the 4-test file live (all pass).

**Verdict: approved, zero findings.** This closes the 2-round defect streak in this file (R1: unrounded raw
decimal; R2: blank-string→fabricated-0) — R3 found no third.
