---
name: project-fix-seo-c-backtesting-r1
description: fix/seo-c-backtesting R1 — verified stat math correct; JSDoc/test-title mischaracterize meta.aiWinRate's actual bug (mixing vs missing-context)
metadata:
  type: project
---

deriveBacktestStats(cases) math-verified against data.json via independent Python recompute:
total=100, indicatorWins=70/70%, decisive=13, aiWins=8/61.5%, neutral=87, trendHits=35/35%,
meanReturn=0.36, median holding=2.5, period 2024-11-26..2026-03-31 — all match test assertions exactly.
19/19 scoped tests pass, tsc clean, i18n:verify passes (2515 keys x 3 locales), 4-locale title/hero/methodology
strings consistent, e2e h1 updated to match.

Found (required): deriveBacktestStats.ts JSDoc + test title both claim
"meta.aiWinRate mixes neutral AI verdicts into a win-rate denominator ... published 61.5% is actually
8/13 decisive" — but reading scripts/backtests/generate-backtest.ts (writeOutput) shows meta.aiWinRate
was ALREADY computed as aiWins/aiDecisive.length (decisive-only denominator, matching 8/13=61.5% exactly).
There is no "mixing" bug in meta's math. The actual pre-existing defect (confirmed via git show
origin/master:BacktestHero.tsx) was that the UI rendered the bare 61.5% under a generic label ("AI
시나리오 적중률(과거)") with zero disclosure of the 13-case decisive denominator — a missing-context/
disclosure bug, not a computation bug. This is a MISTAKES.md 15.6 violation (comment/test-title makes a
factually inaccurate claim about what was broken) and could mislead a future reader into re-"fixing"
meta's math elsewhere.

Found (recommended): messages/_meta/hashes.json still has orphaned entry
"widgets.backtesting.BacktestHero.530709" (old tickerCount label, removed from BacktestHero.tsx this PR).
i18n:verify doesn't flag orphans (matches [[reference-hashes-json-misc-namespace-gap]] precedent), but
unlike prior instances this orphan was created by this PR's own diff, not inherited drift.

Design/FSD: BacktestMethodology reuses hero card tone (border-secondary-700/bg-secondary-800), no new
visual language — verified true by reading the file. Barrel exports correct (entities/backtest-case,
widgets/backtesting). deriveBacktestStats is pure (no fetch/Date.now/console), explicit return type,
computed once at module load in page.tsx (same pattern as existing TICKERS const).
