---
name: project-agent-range-windows-ma50-r3
description: feat/agent-range-windows-ma50 R3 (2026-09-19) — approved; R2 recommended finding (hardcoded ma:{50:[999]} in override test) fixed via new exported MA50_PERIOD constant, decoupled from CONFLUENCE_TREND_MA_PERIOD
metadata:
  type: project
---

R3 of `feat/agent-range-windows-ma50` (worktree `siglens-wt-rr`, uncommitted). Two files: `getBarsIndicators.ts`,
`__tests__/getBarsIndicators.test.ts`. R2's only recommended finding was a hardcoded `ma: { 50: [999] }` in the
override test instead of using a period constant.

Fix: new `export const MA50_PERIOD = 50` in getBarsIndicators.ts, used for `priceVsMa.ma50Pct`'s own `calculateMA`
call — deliberately NOT reusing core's `CONFLUENCE_TREND_MA_PERIOD` (also 50 today), because `ma50Pct` is a
documented tool-contract field name that must not silently change period if the confluence tuning constant is
retuned later. `higherTimeframeView`'s `priceVsMa50Pct` intentionally keeps using `CONFLUENCE_TREND_MA_PERIOD`
(matches the HTF confluence gate it explains) — JSDoc calls this out explicitly, verified accurate.

Verified: grepped confirms no other consumer of MA50_PERIOD, no stray hardcoded `50` where the constant should be
used, scoped test suite 29/29 green (`yarn vitest run .../getBarsIndicators.test.ts`). Approved, no findings.
