---
name: feedback-audit-enumerate-slice-not-difflist
description: When auditing a "thread X through N call sites" remediation, enumerate the whole slice/capability by grep — the remediation's own file list is not the reachable set
metadata:
  type: feedback
---

When a remediation is shaped as "thread a value through N call sites" (currency, marketProfile,
hasOptions, session spec), **do not audit the files the remediation touched**. Grep for the
*capability* across the whole repo and diff that set against the touched set. The miss is always in
the file nobody listed.

**Why:** on `audit/kr-release` round 2, the round-1 report enumerated 5 currency call sites and the
fix consolidated `formatAmount` cleanly across all 5. The defect was in
`widgets/portfolio-position/ui/PositionStatusSummary.tsx` — the only file in that `ui/` directory
the remediation never opened. Reading only the 57-file remediation diff would have approved the
branch. It surfaced from `grep -rn "formatUsd\|'\$'\|\`\$\${" src --include=*.tsx | grep -v __tests__`,
run against the whole tree. The same sweep is what confirmed `QuoteHeader`/`BacktestCaseCard` were
false positives (US-only), so the grep costs one command and settles both directions.

**How to apply:**
- Round 1 or round N, when the fix is "thread X through call sites": grep the *symptom* (hardcoded
  `$`, `isKrEquitySymbol(...) ? ... : ...`, `.tabs.includes('options')`, `formatUsd*`) repo-wide,
  then subtract the files already fixed. Anything left is a candidate.
- Also grep the *helper the fix introduced* and count its production callers. On this branch
  `profileIdForSymbol` was created to kill a duplicated ternary and had 2 callers, while the very
  same commit added 2 fresh hand-rolled copies of that ternary elsewhere.
- Check the fix's test file for the new dimension. If every assertion in
  `PositionStatusSummary.test.tsx` says `$` and there is no KR case, the component was never
  considered — that absence is the tell.

Pairs with [[feedback-check-untracked-files]] (the other way the diff list lies about what changed).
