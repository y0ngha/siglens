---
name: project-groundnumbers-pr205-r4-closed
description: siglens-core PR #205 (fix/grounded-numbers-false-positives) round 4 post-claude-review fix — approved, closes loop
metadata:
  type: project
---

Round 4 of `src/domain/agent/groundedNumbers.ts` fixed claude-review's blocker: comma-thousands
values right after an index-name number ("다우 30,214.55") were previously swallowed because (a)
the name lookahead allowed a following comma and (b) ignorable spans matched by overlap, so a
short name-span could suppress a longer real-value token.

**Fix, verified sound:**
- `INDEX_NAME_NUMBER_RE` lookahead `(?!\d|\.|,\d)` — a trailing `,`+digit (next thousands group)
  now blocks the name match. `i` flag added, dropping the redundant `NASDAQ` key (Hangul/digits
  have no case, so this is safe).
- `ignorableSpans` now returns `{ overlap, exact }` — date/time/list-marker still match by overlap;
  index-name-number and day-period-label spans must match the candidate token's span *exactly*.
- `NUMBER_RE`/`TOOL_NUMBER_RE` digit body `\d(?:[\d,]*\d)?` (was `\d[\d,]*`) — a bare trailing
  prose comma ("S&P 500, 나스닥 100") is no longer absorbed into the number token.
- Nested nullary ternary in `findUngroundedNumbers` extracted to `isTokenGrounded` — behavior
  confirmed identical via `git show d57293c:...` diff (unit → percent → plain, same order).

**Verification method:** hand-traced regex engine step-by-step (not just running tests) against
1,234,567.89 / ₩71,000 / -5,200 / 1.2억 / 3.5% / 5-10% / 3,5,7 prose lists / .5 / S&P500 no-space /
나스닥100 no-space — all correct, several already excluded upstream by the existing letter
lookbehind `(?<![\d\p{L}])` before ever reaching ignorableSpans. Cross-checked every hand-traced
case against the actual added test cases (`다우 30,214.55`, `S&P 500, 나스닥 100`, `코스피 200선`
known-ceiling test) — tests exist for exactly the scenarios reasoned through, all 40 passed live.
`yarn tsc --noEmit` clean. `docs/PUBLIC_API.md` entry accurately describes the diff, no signature
change (single export `findUngroundedNumbers` unaffected).

No findings. Round 4 approved, closes the review loop.
