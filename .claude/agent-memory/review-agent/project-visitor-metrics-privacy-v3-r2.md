---
name: project-visitor-metrics-privacy-v3-r2
description: feat/visitor-user-agent R2 — privacy v3 seed publish + effective-date gate, approved
metadata:
  type: project
---

R1 found `db/seeds/terms/privacy/v2*.md` was edited in place, but `upsertFromSeed`
uses `onConflictDoNothing({ target: [terms.kind, terms.version] })` — v2 was already
seeded in production (`effective_date = 2026-09-08 15:00+00`), so the edit would
never reach the DB (base row frozen; only translations use `onConflictDoUpdate`
and would drift, so ko body would stay old while translations updated — worst of
both).

Fix: reverted all four v2*.md, published privacy v3 instead (`v3.md` +
`v3.en/ja/zh.md`), effective 2026-09-19 00:00 KST (v2 effective 9/9 + 10 days).
`src/app/api/presence/route.ts` gates the three new diagnostic columns
(user_agent, cf-ipcountry, landing_path) behind
`DIAGNOSTIC_COLUMNS_EFFECTIVE_AT = Date.parse('2026-09-18T15:00:00Z')` so
deploying code before the policy takes effect can't collect undisclosed fields.

R2 verified all of this live, approved, no findings:
- v3.md/v3.en/ja/zh.md frontmatter parses correctly under `db/scripts/seedTerms.ts`
  (base has effectiveDate no locale; translations have locale no effectiveDate);
  version 3 contiguous with v1/v2.
- Diffed all 4 locales v2 vs v3 — only the §2 access-statistics sentence changed
  everywhere (adds User-Agent/country/landing-path + bot-ID purpose), rest
  byte-identical.
- Gate constant == v3 effectiveDate exactly (same instant, just UTC vs +09:00
  written form). Test pins `Date.now()` 1s before the gate and asserts nulls;
  default-time tests (after gate) assert real values — inverting `>=` fails both.
- No other file in repo hardcodes a privacy version number;
  `src/entities/terms/api.ts` reads version from the DB row dynamically.

Related: [[project-visitor-metrics-pr783]] (user's global memory, not this
agent's — the original PR #783 approval before this privacy-v3 fix round).
