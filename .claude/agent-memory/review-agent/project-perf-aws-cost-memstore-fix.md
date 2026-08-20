---
name: project-perf-aws-cost-memstore-fix
description: perf/aws-cost-reduction R2 — memStore.mjs setEntry ordering fix + getOrSetCache as-cast comment, both verified live
metadata:
  type: project
---

`perf/aws-cost-reduction` moves FETCH cache entries out of S3 into a process-local
bounded LRU (`cache-handler/memStore.mjs`) to cut S3 PUT cost (FETCH was 81% of
objects, 14% of bytes — small/cheap entries dominating PUT request cost).

R1 found: `setEntry()` deleted the existing entry and decremented `totalBytes`
**before** checking `bytes > MAX_ENTRY_BYTES`, so writing an oversized value to an
already-cached key silently destroyed the valid old entry. R2 fix moved the
`MAX_ENTRY_BYTES` check to the top of the function (before any `store.get`/
`delete`/budget mutation). Verified live: traced all write paths (oversized
same-key, valid overwrite, new key) for accounting leaks — none found. Regression
test added and does reproduce the original bug shape if the ordering regresses.

Second R1 finding: `src/shared/cache/getOrSetCache.ts`'s `inFlight.get(key) as
Promise<T>` cast lacked the guarantee comment required by MISTAKES.md TypeScript §7.
Fixed with a comment explaining the runtime guarantee (cache key is a type-determining
identifier by call-site convention; Redis layer already assumes the same).

**Why this matters for future reviews of this file family**: `cache-handler/*.test.mjs`
and `src/shared/cache/*.test.ts` all use a flat `describe(<subject>, ...)` → `it()`
structure with **module-level `beforeEach`** (not nested inside `describe`). This is
the established, already-approved convention for this specific test family — do not
flag it as a Tests-checklist violation ("beforeEach at module level instead of inside
describe`) when reviewing sibling files in this directory.

R2 approved with zero findings after independently re-running `yarn test cache-handler
src/shared/cache` (187 passed / 2 skipped), `yarn typecheck`, and `yarn lint` on the
modified files myself rather than trusting the round summary numbers.
