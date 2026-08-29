---
name: canonical-korean-names-r3-choke-point
description: R3 of canonical-korean-names PR moved canonical override to loadAllEntries/loadEntriesBySymbols return points; verified complete via grep + live mutation testing, approved with 2 recommended (not required)
metadata:
  type: project
---

Follow-up to [[canonical-korean-names-r2-searchbykorean-gap]]. R3 moved
`withCanonical` from a per-call-site `.map()` in `searchByKoreanName` to the
return points of the two loaders (`loadAllEntries`, `loadEntriesBySymbols`)
in `koreanNameStore.ts`.

Verified live (not just read):
- Repo-wide grep (incl. `scripts/`, `worker/`) confirms no other reader of
  `korean_tickers`'s `koreanName` field exists outside the two loaders —
  `syncKrListedTickers.ts` and `scripts/seed-kr-listed-names.ts` only touch
  listing-status/write paths, never read `koreanName` back out.
- `searchTicker.ts`'s `unmapped = enriched.filter(r => !r.koreanName)`
  self-heal-freeze claim confirmed accurate by direct read — canonical
  symbols are permanently masked out of re-translation, by design, with an
  escape hatch (remove from `CANONICAL_KOREAN_NAMES` map).
- Live mutation test (temp-edit + revert via backup, not left in tree):
  stripping `.map(withCanonical)` from `loadAllEntries`'s **DB-fetch**
  branch (the `cached === null` path, separate from the cache-hit branch at
  the top of the function) survives all 32 tests in
  `koreanNameStore.test.ts` + all of `getAssetInfo.test.ts`. The round's own
  mutation-testing claim only covered the cache-hit branch. Reported as
  recommended (not required) since the *code* is correct on inspection —
  only test coverage of that branch is missing, and it's the same
  regression class the whole PR exists to catch.
- Also noted (recommended, not required): `getKoreanNames` still applies
  `CANONICAL_KOREAN_NAMES.get(symbol) ?? symbolMap.get(symbol)` itself,
  independent of the loader-level `withCanonical` — necessary for the
  zero-row case (loader can't synthesize an entry that doesn't exist), but
  makes the round's "single choke point / call sites no longer apply it
  individually" framing an overstatement for symbols that do have a row.

Lesson: when a round's summary claims "mutation-verified" for a fix,
verify which specific branch/return-site was actually mutated — a function
with 2+ return paths applying the same corrective map needs mutation
coverage on **each** path independently; testing one path's removal doesn't
prove the sibling path is covered too.
