---
name: project-core-news-macro-calendar-r2
description: siglens-core feat/news-macro-calendar R2 — parseCalendarDate move verbatim; TZ regression test vacuous on UTC CI; stale fingerprint JSDoc in news/types.ts
metadata:
  type: project
---

R2 (2026-09-28): all R1 fixes landed; typecheck/lint/prettier green; 454 scoped tests pass under TZ=UTC, Asia/Seoul, America/New_York.
parseCalendarDate moved from macroBriefingPrompt.ts to promptFormat.ts byte-for-byte, so briefing output is unchanged.

Recommended only:
- The naive-timestamp TZ regression test (`00:30:00 UTC (in 7 days)`) fails on the old bug only in a positive-offset TZ. Local is KST, but CI is ubuntu-latest (UTC), so the test is vacuous in CI. Fix by pinning process.env.TZ or testing parseCalendarDate directly.
- application/news/types.ts:46 JSDoc still says the fingerprint is `date|event|actual`, but it now covers all 7 fields.

**Why:** a TZ bug's regression test is only falsifiable if the runner's TZ has a nonzero offset in the right direction.
**How to apply:** for any "parse as local vs UTC" fix, check what TZ CI runs in before trusting the test.
