# Indicator Name Korean Dictionary — One-Time Seeding Procedure

`INDICATOR_NAME_KO` (`src/entities/economy/lib/indicatorNameKo.ts`) is the
source-of-truth (`dict`) for economic-indicator Korean names. SP-B Task 1 seeds
the ~28 most common indicators from the FMP sample. This procedure curates the
full ~277 distinct normalized base names into the dictionary as a follow-up data
task. Anything not in the dictionary is AI-translated on-miss and cached
(`source:'ai'`) in `economic_indicator_translations` — so this seeding is an
optimization (instant Korean, no AI round-trip) and a quality-control gate
(human-curated vs. machine draft), not a correctness requirement.

## Inputs

- **`scripts/output/economic-calendar-indicator-names.json`** — the distinct
  normalized base-name set produced by SP-A's backfill
  (`yarn db:backfill:calendar`). ~277 entries, sorted.

## Steps

1. **Run the SP-A backfill** (user, one-time) to regenerate the name dump:
   `yarn db:backfill:calendar`. Confirm the JSON file exists and its length is
   ~277.

2. **Draft translations via core AI.** For each name not already in
   `INDICATOR_NAME_KO`, obtain a Korean draft. Two equivalent options:
   - Let the running app self-heal: deploy SP-B, let `/economy` traffic trigger
     `ensureIndicatorTranslatedAction` for misses, then `SELECT normalized_name,
     korean_name FROM economic_indicator_translations WHERE source = 'ai'` to
     read the machine drafts back.
   - Or call core `submitIndicatorTranslation(name)` + `pollIndicatorTranslation`
     directly in a throwaway script over the dump (core must be published first).

3. **Curate.** Review each draft for: domain accuracy (지표 의미), consistent
   terminology (e.g. always `근원` for "Core", `전년比`/`전월比`/`전분기比` for
   YoY/MoM/QoQ — these come from `koreanizePeriodToken`, so the **base** must NOT
   embed the period token; keep base period-free except where the FMP base name
   itself carries a direction, like `... YoY`, which the seed already folds into
   the Korean), and house style (no trailing punctuation). Fix anything wrong.

4. **Fill `INDICATOR_NAME_KO`.** Add the curated `'<base>': '<korean>'` entries
   to the const map, keeping the existing grouping comments (물가 / 고용 /
   성장·심리 / 정책·국채 / …). Keys MUST be the **normalized base** form
   (`normalizeIndicatorName(raw).base`) — no trailing `(May)`/`(Q1)`.

5. **Promote, optionally.** Rows curated into the dict can have their DB cache
   row updated to `source:'dict'` (or left as-is — the dict short-circuits the
   DB read either way, since `INDICATOR_NAME_KO` is checked first).

6. **Verify.** Extend `indicatorNameKo.test.ts` with spot-check assertions for a
   handful of newly-added high-traffic indicators, then `yarn test`.

## Guardrails

- Do NOT machine-bulk-paste drafts without review — a wrong indicator
  translation is user-visible and misleading.
- Keep base keys period-free; the period parenthetical is Korean-ized separately
  by `koreanizePeriodToken` at display time.
- The dictionary is plain data — no logic. Reviewers should treat large dict
  additions as a data PR (spot-check, not line-by-line lint).
