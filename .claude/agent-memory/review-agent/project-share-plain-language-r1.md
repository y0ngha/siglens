---
name: share-plain-language-r1
description: feat/share-plain-language R1 — contentHash omits `plain`, so dedupe silently drops the sharer's own on-screen prose on hash collision
metadata:
  type: project
---

R1 review of `feat/share-plain-language` (siglens-share-plain worktree). Threads
the "쉽게보기" plain-language prose through to share snapshots so shared-link
viewers get the same toggle. 19 files, matches `git status -uall` exactly (no
untracked files, quiescent — all mtimes within one 5-min window).

## Required: contentHash doesn't cover `plain` — dedupe silently drops it

`contentHash()` (`src/entities/shared-analysis/lib/contentHash.ts`, NOT touched
by this PR) hashes `kind + symbol + locale + result + chartBars`. It does NOT
include `plain`. `DrizzleSharedAnalysisRepository.create()` does
`ON CONFLICT (content_hash) DO UPDATE SET expiresAt = ...` — on a hash
collision, only `expiresAt` is bumped; `snapshotJson` (and therefore `plain`)
of the FIRST share wins and is frozen for up to 7 days (SHARE_TTL_DAYS).

The file's own doc comment explains that `chartBars` was deliberately added to
the hash for exactly this reason ("동일 AI 분석 결과여도 다른 시점의 차트
데이터를 가진 공유는 별도 스냅샷으로 취급돼 각 공유자가 자신이 본 차트를 그대로
유지한다") — the identical rationale applies to `plain`, but it wasn't added.

Since analysis results are cache-shared across many visitors of the same
symbol/timeframe, and `ShareableAnalysisContext.tsx`'s own comment documents
that `plain` "arrives after result" (a real race), it's plausible for the
first sharer of a popular symbol to click share right as status flips to
'success' but before `plain` arrives — locking that (missing) `plain` in for
every subsequent sharer of the same cached result, silently, for up to 7 days.
This defeats the feature's stated guarantee that each sharer's own on-screen
prose is sent. No test exercises this path (`contentHash.test.ts` untouched,
no plain-vs-hash-collision test in `buildShareSnapshot.test.ts` or
`createShareSnapshotAction`).

Fix direction (not implemented — read-only): add `plain` to the `contentHash`
payload the same way `chartBars` was added, so a plain-text difference
produces its own row instead of reusing an unrelated stale one.

## Recommended: server-side `isNonEmptyString` doesn't trim `plain`

`assertValidInput.ts`'s `isNonEmptyString` only checks `length > 0`, so a
whitespace-only `plain` (e.g. `"   "`) would pass server validation even
though `useShareFlow.ts`'s client already filters these out before sending
(`plain.trim().length > 0`). Not reachable through the normal UI flow, but a
defense-in-depth gap versus the client-side guard — worth trimming server-side
too (`Buffer.byteLength` measurement is already correct either way).

## Non-issues verified during this review (don't re-flag)

- All 7 registration call sites (chart via `ChartContent.tsx` + 6 widgets:
  congress/financials/fundamental/news/options/overall) correctly gate
  `plain` on `status === 'done'` (or, for chart, on `useAnalysis`'s `plain`
  state which is independently null until a real mutation succeeds — same
  effect). `fear-greed` kind has NO plain-language feature on the live page
  at all (no `PlainAnalysisSwitch`, no plain state) — the registry's
  `WithPlainSwitch` wrap around `FearGreedShareView` is a harmless no-op
  (`PlainAnalysisSwitch` with `plain=undefined` just renders `children`).
- `parseSnapshot.ts` (untouched) passes `plain` through transparently via its
  existing `obj as unknown as SharedAnalysisSnapshot` cast — old snapshots
  without the field render exactly as before (`plain: undefined`,
  `PlainAnalysisSwitch`/`WithPlainSwitch` render raw-only, no crash).
  `kindServerRegistry.ts`/`buildOgText.ts`/`getSharedAnalysisAction.ts` have
  zero `plain` references — OG generation is unaffected.
  `ShareKindPanel.test.tsx` + `buildShareSnapshot.test.ts` both have explicit
  "omits/no plain" tests confirming this.
  ChartContent's chart-kind panel correctly forwards `plain` INTO
  `AnalysisPanel` (which owns its own switch) rather than double-wrapping —
  `kindPanelRegistry.tsx` comment + `ShareKindPanel.test.tsx` "no double
  switch" test both confirm.
- FSD layers clean: entity (`shared-analysis`) only imports `shared/*` +
  `@y0ngha/siglens-core`; feature (`share`) imports the entity + `shared/*`;
  widgets import the feature (allowed, features is below widgets); views
  import widgets/features (both below views). No deep imports, no upward
  imports.
- `MAX_PLAIN_BYTES` (32 KB) is independent of `MAX_RESULT_BYTES` (64 KB) and
  checked with `Buffer.byteLength(..., 'utf8')` — correct multibyte handling
  for Korean text, consistent with the existing `MAX_RESULT_BYTES` pattern.
- `ShareableAnalysisContext.tsx`'s effect deps correctly include `plain` (a
  primitive) directly rather than via ref, specifically to re-register when
  plain arrives after result — verified by a real test
  ("re-registers when plain prose arrives after the result"), not
  tautological.
- Repeated `plain: x.status === 'done' ? x.plain : null` one-liner across 6
  widget call sites is NOT new AHA-violating duplication — it mirrors the
  pre-existing identical-shape `result: x.status === 'done' ? x.result : null`
  line already present in each of those (unmodified-by-this-PR) call sites;
  each widget's `analysis` discriminated union has different field names so a
  shared helper wouldn't meaningfully collapse it.
