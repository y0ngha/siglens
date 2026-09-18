---
name: project-seo-meta-description-markdown-r1
description: fix/seo-meta-description-markdown R1 — stripSnapshotMarkdown move to shared/lib, collapseToSingleLine now strips markdown before joining lines; found latent false-pair corruption in single-marker regexes
metadata:
  type: project
---

Branch `fix/seo-meta-description-markdown` (worktree `siglens-wt-seo-desc`), R1 review.
Production crawl after v0.79.2 showed `<meta name="description">` starting with literal
`**종합 진단**:` — the plain-language min-length fallback (PR #839) exposed the raw
`summary` field (screen-only markdown via `MarkdownText`) directly into the SERP snippet.

**Fix shape**: `stripSnapshotMarkdown` (unchanged logic) moved `views/symbol/snapshot/lib`
→ `shared/lib` (FSD: `shared/lib/seo.ts` cannot import from `views`). All 8 importers
(7 renderer files + `narrowStringArray.ts`) repointed — verified via grep, 0 stale refs.
`collapseToSingleLine` in `seo.ts` now calls `stripSnapshotMarkdown` before the
`\n`-split/join (so line-leading `- `/`#` markers are still recognized per-line — order
matters). Live mutation-verified: reverting the strip call fails exactly the new
"원문 필드의 마크다운 기호는 설명에 남기지 않는다" test with the literal reported bug.

**Finding raised (recommended, not required)**: `stripSnapshotMarkdown`'s single-marker
italic regexes (`/\*(.+?)\*/g`, `/_(.+?)_/g`, lines 44-45) have no requirement that the two
markers form an intended pair. If a field contains TWO unrelated bare `*`/`_` occurrences
(e.g. two underscore-notation ticker mentions, or two `*`-multiplication expressions), the
regex treats them as one italic pair and silently **deletes the text between them** — not
just the markers. Confirmed via live repro:
`stripSnapshotMarkdown('BRK_A와 BRK_B를 비교하면 BRK_B가...')` → `'BRKA와 BRKB를 비교하면...'`
(underscores AND the words between them eaten); same for two `*N` multiplication tokens.
Judged **recommended not required** because: (1) logic is unchanged/pre-existing across 8
already-shipped renderer files, not introduced by this diff; (2) this repo's own ticker
convention (`ticker.ts`) uses `.` not `_` for dual-class tickers (`BRK.B`), so the concrete
repro string doesn't occur for real tickers; (3) doesn't reproduce the exact reported bug
shape. Still worth hardening given the function's exposure just expanded to the
crawler-visible meta description (the same class of surface this PR exists to protect).
Relevant to MISTAKES 20.5 (substring/pattern matching without proper boundaries).

Gates independently re-verified in R1: tsc clean, oxlint clean on touched files, full
targeted test files (218 tests) green, skips.json diff is pure line-number renumbering
(i18n:extract --write ran correctly).
