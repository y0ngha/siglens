---
name: canonical-korean-names-r4-closed
description: R4 of canonical-korean-names PR — both R3 recommended findings verified fixed via live mutation test; loop closes approved
metadata:
  type: project
---

Follow-up to [[canonical-korean-names-r3-choke-point]]. R4 touched only
`koreanNameStore.ts` (JSDoc addition) and `koreanNameStore.test.ts` (one new
test) — both changes verified correct:

- New test `cache miss → DB 경로에서도 정본을 입힌다` targets exactly the
  branch R3 flagged (`loadAllEntries`'s `cached === null` path, the
  `entries.map(withCanonical)` at the DB-fetch return). Independently
  mutation-verified live: reverting that one line to `return entries;`
  fails only this new test (1 fail / 32 pass), restoring it returns to
  33/33 green.
- JSDoc warning on `withCanonical` ("지우지 말 것") correctly scopes the
  claim: `getKoreanNames`'s own `CANONICAL_KOREAN_NAMES.get(symbol) ??
  symbolMap.get(symbol)` produces the *same* result as the loader for
  symbols with an existing row (since `loadEntriesBySymbols` already
  applied `withCanonical` before `symbolMap` is built) but is load-bearing
  for the zero-row case, which the loader structurally cannot synthesize.
  Verified this claim against the actual code path, not just the prose.

Loop closed at R4 — approved, no findings.
