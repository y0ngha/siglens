---
name: project-core-pattern-signal-expansion-r2
description: siglens-core feat/pattern-signal-expansion R2 — approved; stomach isLongBody(prev) fix + all R1 boundary/doc nits closed
metadata:
  type: project
---

R2 (2026-09-28) approved. typecheck/lint/prettier clean, 75 scoped files / 2298 tests green.

Verified: `prevLong` on both stomach branches is killed by dedicated tests (short-prev above, zero-body
prev below, plus entries-level dragonfly+belt-hold test). Inclusive `>=`/`<=` boundaries for stomach
midpoint, strike b4.open==b3.close, three-methods b5.close==b1.close all pinned both directions.
rounding_top rim span test uses 40−y mirror fixture with 10<17 just outside each bound.
Spec §1.2 table (12.4% → 2.0% hit, 48.8% → 10.5% windows) matches candle.ts comment and PUBLIC_API row.
Harmless leftover: spec line 36 still says "(기존 라벨 결과 불변)" but §1.2 below qualifies it.

Follows [[project-core-pattern-signal-expansion-r1]].
