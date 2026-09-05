---
name: share-plain-language-r2-closed
description: feat/share-plain-language R2 (final) — both R1 findings verified fixed, approved, closes loop
metadata:
  type: project
---

R1 found (1) REQUIRED `contentHash` omitted `plain`, letting `ON CONFLICT ...
DO UPDATE SET expiresAt` silently freeze the first sharer's (possibly missing)
`plain` for a hash-colliding `result`, and (2) RECOMMENDED whitespace-only
`plain` passed server validation.

R2 fix verified correct, matching the `chartBars` precedent exactly:
- `contentHash()` gained a 6th optional `plain?: string` param, spread into
  the payload only `when defined` (`...(plain !== undefined && { plain })`),
  so pre-feature hashes stay byte-identical when `plain` is omitted — matches
  `chartBars`'s existing `undefined`-guard pattern.
- `createShareSnapshotAction.ts` threads `snapshot.plain` (typed
  `string | undefined` in `types.ts`, populated by the pre-existing
  `buildShareSnapshot.ts` spread) into the new 6th arg — types line up end
  to end, no `any`.
- `contentHash.test.ts` adds a `describe('plain (쉬운보기) participates in
  dedupe')` block: differs when plain differs for the same result, differs
  between with/without plain, and omitting plain reproduces the pre-feature
  hash exactly (3-way check, not just "it changes").
- `assertValidInput.ts`'s `plain` branch now rejects
  `!isNonEmptyString(o.plain) || o.plain.trim().length === 0` — catches
  `''` and whitespace-only alike; `assertValidInput.test.ts` adds both cases
  plus a non-string-plain case. Client (`useShareFlow.ts`) already guards with
  the same `trim().length > 0` predicate before sending, and neither side
  trims the stored value — consistent on both paths, no
  MISTAKES.md-1397-style trim-mismatch.

No new findings. Approved, closes the review loop for this feature. See also
[[project-share-plain-language-r1]].
