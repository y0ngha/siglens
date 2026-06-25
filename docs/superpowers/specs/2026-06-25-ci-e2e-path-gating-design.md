# CI/E2E Path Gating — Design

- **Date**: 2026-06-25
- **Status**: Approved (design), pending implementation plan
- **Scope**: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`, new `.github/path-filters.yml`

## Problem

`ci.yml` (typecheck, validate:skills, lint, format:check, test) and `e2e.yml`
(cold prod build + Playwright chromium/webkit + Docker backend) currently run on
**every** PR push regardless of what changed. Docs-only, refs-only, and
agent-config-only PRs trigger the full pipelines — wasted GitHub Actions minutes.

Goal: run each workflow **only when a file that can affect its outcome changed**,
without weakening correctness (a broken change must never skip its check).

## Constraints & Facts (measured 2026-06-25)

1. **Neither CI nor E2E is a required status check today.** master has no classic
   branch protection; its ruleset enforces only `deletion` / `non_fast_forward` /
   `pull_request` — no `required_status_checks` rule. **But the user intends to
   make them required later**, so the design must be required-compatible.
2. **`*.md` is in `.prettierignore`** → markdown never affects `format:check`.
   Also prettier-ignored: `.github/*`, `.gemini/*`, `.agents/*`, `.claude/*`,
   `.superpowers/*`, `public/`, `/.idea/`, `*.tsbuildinfo`, `next-env.d.ts`.
3. **skills are all `.md`** (81 files under `skills/`), read at **runtime** via
   `fs.readdir` in `src/entities/skill/api.ts` (NOT bundled at build). Therefore:
   - skills `.md` changes **do** affect CI (`validate:skills` step).
   - skills `.md` changes **do not** affect the E2E prod build.
4. **`tsc --noEmit` typechecks `**/*.ts` + `**/*.tsx` repo-wide**, excluding only
   `node_modules`, `worker`, `scripts`. So `e2e/**`, `drizzle/**`, `db/**`, and
   root `*.ts` (configs, `update-popular-tickers.ts`) **are** typechecked by CI.
   The CI "irrelevant" set is therefore narrow.

## Safety Principle (why denylist, not allowlist)

The dangerous failure is a **false-negative skip**: a check is skipped when it
should have run, so broken code merges. This matters more once checks are
required.

- An **allowlist** ("run only if these files changed") fails toward false-negative
  skips — forget one impactful path and broken code passes.
- A **denylist** ("skip only if *every* changed file is provably irrelevant")
  fails toward false-positive runs — the workflow runs unnecessarily (wasted
  minutes, but safe).

Both workflows therefore use a denylist. dorny cannot express "skip only if
*every* changed file is irrelevant" directly — its filter output is always "does
**any** changed file match" (OR across files), and it supports neither negation
(`!`) patterns nor a useful "all files" quantifier (`predicate-quantifier: every`
is a *per-file* AND across patterns, not "all changed files"). The denylist is
instead implemented with dorny's **`${FILTER}_count`** outputs:

- `all` filter = `['**']` (dorny sets picomatch `dot: true`, so `**` matches
  dotfiles/dot-dirs too) → `all_count` = total changed files.
- `*_irrelevant` filter → `*_irrelevant_count` = changed files in the irrelevant set.
- **`run = (all_count != irrelevant_count)`** — true iff at least one changed file
  is outside the irrelevant set. Equal counts ⇒ every changed file is irrelevant ⇒
  skip. Forgetting an irrelevant path makes it count as relevant ⇒ workflow runs
  unnecessarily (the safe failure direction).

## Architecture

Both workflows keep `on: pull_request` (always trigger — no `on.paths`, which
would leave a required check stuck "pending" when skipped). Gating happens at the
**job** level via a cheap detect job, and a **gate job** reports the final
required-compatible status.

Per-workflow 3-job structure:

```
jobs:
  changes:            # detect — actions/checkout (no Node/yarn) + dorny/paths-filter
    # checkout is needed only to read .github/path-filters.yml from the workspace;
    # the PR diff itself comes from the GitHub REST API (~15s total)
    # permissions: contents: read (checkout) + pull-requests: read (dorny API)
    outputs: { run }  # ci_run for ci.yml, e2e_run for e2e.yml

  <work>:             # existing ci / e2e job, steps UNCHANGED
    needs: changes
    if: needs.changes.outputs.run == 'true'

  <work>-required:    # gate — always runs, reports status
    needs: [changes, <work>]
    if: always()
    # fail iff changes failed OR <work>.result is failure/cancelled;
    # <work> skipped or success => pass (green)
```

When `<work>` is skipped, `needs.<work>.result == 'skipped'` and the gate passes
green. The gate **also fails if the `changes` detect job itself failed**, so a
dorny error can never silently green-light a skipped check. **The gate job
(`ci-required` / `e2e-required`) is the job to mark as the required status check**
once the user flips required on — never the heavy job itself.

GitHub treats a **job** skipped by an `if:` conditional as a *successful* required
check; only a whole **workflow** skipped by `on.paths`/`paths-ignore` stays stuck
"pending". That is why gating lives at the job level with an always-running gate,
not at the workflow trigger.

## Filter Definitions — `.github/path-filters.yml`

Shared by both workflows (single source of truth). The detect job runs **one**
`dorny/paths-filter` step (default quantifier) and reads the counts from its
outputs — no `predicate-quantifier` needed.

`path-filters.yml` named filters. **Filter names use underscores, not hyphens** —
dorny exposes each filter (and `${name}_count`) as a step output, and a hyphenated
name like `ci-irrelevant` is parsed as subtraction (`ci - irrelevant`) in a GitHub
expression. dorny **flattens** nested lists pulled in via YAML anchors — this is
dorny's documented `&shared` / `*shared` reuse pattern — so `- *common_irrelevant`
as a list item expands inline.

```yaml
# Total changed files (picomatch dot:true ⇒ ** matches dotfiles too).
all:
  - '**'

# Files whose change cannot affect ANY check (CI or E2E).
common_irrelevant: &common_irrelevant
  - 'docs/**'
  - 'refs/**'
  - '**/*.md'          # markdown: prettier-ignored, not typechecked, not tested
  - '.claude/**'
  - '.gemini/**'
  - '.agents/**'
  - '.superpowers/**'
  - '.idea/**'
  - '.vscode/**'
  - '.husky/**'        # git hooks: shell, not run/checked in CI
  - 'LICENSE'

# CI is irrelevant only for the common set. (skills/** is .md and matches
# **/*.md above — the `skills` rescue filter forces CI back on for those.)
ci_irrelevant: *common_irrelevant

# E2E (prod build + Playwright) is additionally blind to lint/format/unit-test
# tooling and to skills (read at runtime, not bundled). dorny flattens the
# nested anchor list below.
e2e_irrelevant:
  - *common_irrelevant
  - 'skills/**'
  - 'skills-lock.json'
  - 'eslint.config.mjs'
  - '.stylelintrc.cjs'
  - '.prettierrc.cjs'
  - '.prettierignore'
  - 'vitest.config.ts'
  - 'vitest.setup.*.ts'
  - 'lint-staged.config.mjs'
  - 'scripts/validate-skills.ts'
  - '.github/workflows/ci.yml'

# Rescue signal: any of these MUST run CI (validate:skills) even though
# skills/**/*.md matches **/*.md in ci_irrelevant.
skills:
  - 'skills/**'
  - 'skills-lock.json'
  - 'scripts/validate-skills.ts'
```

Gating expressions (computed in the `changes` job `outputs:`, where `f` is the
single dorny step id):

- `ci_run  = (steps.f.outputs.all_count != steps.f.outputs.ci_irrelevant_count) || (steps.f.outputs.skills == 'true')`
- `e2e_run = (steps.f.outputs.all_count != steps.f.outputs.e2e_irrelevant_count)`

The `skills` rescue is needed because skills are `.md` and so fall inside
`ci_irrelevant` via `**/*.md`; without it a skills-only PR would skip CI and miss
`validate:skills`. (E2E does not read skills at build time, so no rescue there.)

### Worked examples

| PR changes | `ci_run` | `e2e_run` |
|---|---|---|
| only `docs/foo.md` | false (skip) | false (skip) |
| only `skills/patterns/x.md` | **true** (skills rescue) | false (skip) |
| only `eslint.config.mjs` | true | false (skip) |
| only `src/widgets/x.tsx` | true | true |
| `src/x.ts` + `docs/y.md` | true (not all irrelevant) | true |
| only `e2e/specs/x.spec.ts` | true (typechecked) | true |

## Cleanups (folded into this change)

- Remove the dead `push: branches: [feat/e2e-playwright-foundation]` trigger from
  `e2e.yml` (branch long merged). Both workflows stay PR-only — unchanged behavior
  for master pushes (deploy.yml owns those).
- The `changes` job needs `contents: read` (to checkout `path-filters.yml`) **and**
  `pull-requests: read` (dorny fetches the PR diff via REST API). The detect/gate
  jobs need no `SIGLENS_GITHUB_TOKEN` (no yarn install). Heavy jobs keep their
  existing `contents: read` + `SIGLENS_GITHUB_TOKEN`.

## Out of Scope

- Intra-workflow **step-level** gating (e.g. running only `validate:skills` inside
  CI). Install/runner setup dominates CI cost; skipping a single fast step saves
  little while adding complexity. CI stays atomic — it runs fully or not at all.
- Splitting CI into parallel per-check jobs. Each job pays its own `yarn install`;
  for the common multi-category PR this would cost *more*, not less.
- Making the checks required. That is a separate GitHub settings change the user
  performs when ready; this design makes it safe to do so.

## Verified Assumptions (research 2026-06-25)

Load-bearing external behaviors, confirmed against primary sources before committing
to this design:

| Assumption | Verdict | Source |
|---|---|---|
| A **job** skipped by `if:` counts as a *successful* required check; only a **workflow** skipped by `on.paths` stays "pending" | ✅ confirmed | GitHub Docs — Troubleshooting required status checks |
| dorny `filters` accepts a **file path** (`.github/path-filters.yml`) | ✅ | dorny README |
| For `pull_request`, dorny gets the diff via **REST API** (no checkout for the diff), needs `pull-requests: read` | ✅ | dorny README |
| The **filters file** still must exist in the workspace ⇒ detect job needs `actions/checkout` | ✅ inferred (file read is local) | dorny README |
| dorny uses picomatch with **`dot: true`** ⇒ `**` matches `.claude`, `.nvmrc` | ✅ | dorny `src/filter.ts` |
| dorny does **NOT** support negation (`!`) patterns as exclusions (each pattern OR'd independently) | ✅ confirmed — **invalidated the original `!`/`every` denylist idea** | dorny `src/filter.ts` |
| `predicate-quantifier: every` is per-file AND across patterns, **not** "all changed files" | ✅ | dorny README + `src/filter.ts` |
| dorny exposes **`${FILTER}_count`** outputs ⇒ enables the count-based denylist | ✅ | dorny README |
| dorny flattens **nested YAML-anchor lists** (`- *shared`) | ✅ (documented `&shared`/`*shared` example) | dorny README |
| Latest dorny major is **v4** | ✅ | dorny README/CHANGELOG |

The count-based denylist (`all_count != irrelevant_count`) replaced the original
`predicate-quantifier: every` mechanism, which the research showed does not mean
what the first draft assumed.

## Testing / Verification

No unit tests apply (CI config). Verification is empirical against real PR diffs:

1. Open a docs-only PR (or push a docs-only commit) → confirm both `ci` and `e2e`
   jobs show **skipped** and `ci-required` / `e2e-required` show **success**.
2. Open a skills-`.md`-only PR → `ci` runs (validate:skills green), `e2e` skips.
3. Open a `src/**` PR → both run as today.
4. Confirm `ci-required` / `e2e-required` are green in all three so they are safe
   to mark as required checks.

<!-- gating verification probe: docs-only change, expect ci+e2e SKIP -->
