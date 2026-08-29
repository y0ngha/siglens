---
name: project-seo-internal-links-relatedsymbols-r4
description: seo-internal-links-dead-symbols branch round 4 — doc-only JSDoc relocation fix in relatedSymbols.ts, approved
metadata:
  type: project
---

Branch `worktree-seo-internal-links-dead-symbols`, round 4 (final round of the doc-fix loop tracked
across R1-R4). Only `src/shared/config/relatedSymbols.ts` in scope — a comment-only diff moving
`themePeersOf`'s stranded JSDoc back above its own function (it had been left above `roundRobinMerge`
since the R2 extraction) and correcting two stale phrases into `{@link SYMBOL_LINK_RINGS}` /
`{@link CROSS_MARKET_THEME_GROUPS}` references.

Verified live: grepped for the old "아래 링 분리" phrase (gone), confirmed file order
(`THEME_PEER_GROUPS` → `roundRobinMerge`+doc → `themePeersOf`+doc → `SYMBOL_LINK_RINGS`), confirmed
`tsc --noEmit` and `oxlint` both clean on the file directly (not just via author's summary).

Note: this file is untracked (`??` in git status) in the worktree, so `git diff master -- <file>`
returns nothing — don't mistake that for "no changes," check `git status` first. See
[[feedback-file-can-change-mid-review]] pattern — same branch, doc kept getting orphaned by earlier
extractions.

Approved, round 4, zero findings.
