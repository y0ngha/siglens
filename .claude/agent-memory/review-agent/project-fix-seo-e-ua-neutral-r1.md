---
name: fix-seo-e-ua-neutral-r1
description: R1 review of fix/seo-e-ua-neutral (UA-neutral reader view, cloaking fix) — approved, no findings
metadata:
  type: project
---

Branch removed the `isBotRequest` guard from `withReaderViews` in `src/app/api/analysis/stream/route.ts` so bots and humans get the identical plain-language body (fixes a Google cloaking-pattern risk). Cost concern from the old guard's removal is covered by the existing 30-day plain-language cache (`entities/analysis-plain/api.ts` `CACHE_TTL_SECONDS`), verified live.

Verified clean:
- `skipEnqueueIfMiss` / `isBotRequest` still gate concurrency ceiling (`canAcceptAnalysisStream`) and the DISPATCH `overall` history-skip — both untouched, unrelated to the removed plain-language UA branch.
- Both `withReaderViews` call sites correctly dropped the trailing UA arg (arity now 4, matches new signature).
- New/changed tests are falsifiable: they assert on the actual SSE `event: done` payload content (not just spy-called), so reinstating the UA guard would fail them. Ran `yarn test` on the file live — 119/119 pass.
- `PlainAnalysisSwitch.tsx` comment claim ("hiding is UA-independent, gated only by `hasPlain && mode`") matches the actual `showPlain` derivation — no UA reference left in that file.
- i18n: `liveCrossRef` reworded consistently across en/ja/zh/ko. Checked `messages/_meta/hashes.json` for a stale-hash regression risk — the key was never tracked there in the first place (hand-authored key, not extract.mjs-generated), so this is a pre-existing gap, not something this diff introduced. See [[reference-hashes-json-misc-namespace-gap]].

Minor/non-blocking: `src/views/symbol/snapshot/__tests__/liveAnalysisCrossRefRestriction.test.ts` has a doc-comment quoting the pre-rework Korean sentence verbatim — now stale text in a comment only (no functional assertion depends on it), file untouched by this PR, so left as informational rather than a required finding.
