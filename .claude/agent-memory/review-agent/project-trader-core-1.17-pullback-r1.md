---
name: trader-core-1.17-pullback-r1
description: siglens-trader chore/core-1.17-pullback R1 — core 1.15.1→1.17.0 bump (evaluatePullback, confluence-authority retirement in prompt) + skills/ resync; approved
metadata:
  type: project
---

siglens-trader worktree `/Users/y0ngha/Project/siglens-trader-wt-core117`, branch chore/core-1.17-pullback (2026-09-26). Uncommitted diff; tsc 0, eslint 0, format 0, 78 files/1552 tests green. Approved round 1.

- `lib/strategy/mean-reversion.ts` (the parity-tested daily RSI(2) rule) untouched — confirmed via `git log -1` on that path showing no new commit on this branch.
- `evaluatePullback` (new core 1.17.0 export) has zero references anywhere in trader — unused, no action needed.
- `entryRecommendation` ('enter'|'wait'|'avoid') shape unchanged despite core's rule-semantics rewrite (washout-in-uptrend now allows 'enter', bearish confluence no longer drives 'avoid') — `lib/strategy/safe-extract.ts` `safeActionRecommendation` still only validates against the same 3 literals, and `entry-review.ts` only displays the value as opaque prompt text (`진입 권고: ${...}`), never branches on it. Semantic change is inert for trader.
- `confluence_min` hit in `api/__tests__/routes.test.ts` is trader's own retired local config key (unrelated to core's prompt-side "confluence authority" retirement) — false-positive grep hit, traced and dismissed.
- skills/ resync: diffed trader's copy against the actual source commit (`be8b6988a`, branch `claude/siglens-analysis-technique-review-wvfffz`, found via `git log --all --oneline --source`) — only `skills/strategies/mean-reversion.md` differs, and only by one extra paragraph in trader's copy referencing the new `### Short-Term Washout` prompt block (a forward-looking addition consistent with core 1.17.0, not a loss). No trader-only customizations exist in `skills/` history (`git log --all --oneline -- skills/` shows only bulk sync commits). `skills-lock.json` is an unrelated Claude Code plugin lock file, not a skills/strategies hash lock — no companion file needs updating.
- No code anywhere in trader reads skill frontmatter fields (`digest_hash`/`token_cost`/`confidence_weight`/`indicators`) programmatically — skills/ is loaded as raw markdown at runtime for the analysis prompt only (per repo's own CLAUDE.md), so content-only skill edits can't break trader code.

**Why:** confirms the pattern from [[trader-precomputed-core-1.11-r1]]/[[trader-core-1.11.1-bump-r1]] — trader's own domain layer (mean-reversion rule, entryRecommendation display) is decoupled enough from core's prompt/algorithm internals that most core version bumps are inert here; the reviewable surface is really just "did any *shape* change, not just the values it produces."

**How to apply:** for a trader core-bump PR, (1) `git log -1 -- lib/strategy/mean-reversion.ts` to confirm the parity-tested rule wasn't touched, (2) grep every new/changed core export name across trader to check it's actually consumed, (3) for skills/ resyncs, find the real source commit via `git log --all --oneline --source -- skills/<file>` in the siglens repo (not just current branch) before diffing — do NOT `git checkout <ref> -- skills/` with `--work-tree` pointed elsewhere while cwd'd into the main siglens checkout, it dirties the main repo's index/worktree even with a separate `--work-tree`; use a throwaway clone or `git show <ref>:path > tmpfile` instead, and `git reset --hard HEAD` immediately if it happens.
