# CI/E2E Path Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ci.yml` and `e2e.yml` skip their heavy jobs when a PR changes only files that cannot affect their outcome, without weakening correctness and while staying safe to mark as required checks later.

**Architecture:** Each workflow keeps `on: pull_request` (always triggers) and gains a 3-job shape — a cheap `changes` detect job (dorny/paths-filter, count-based denylist), the existing heavy job gated by an `if:`, and an always-running `*-required` gate job that reports the merge-blocking status. A shared `.github/path-filters.yml` is the single source of truth for the irrelevant sets.

**Tech Stack:** GitHub Actions, `dorny/paths-filter@v4` (picomatch, `dot:true`), bash gate steps.

**Spec:** `docs/superpowers/specs/2026-06-25-ci-e2e-path-gating-design.md`

---

## File Structure

- **Create** `.github/path-filters.yml` — shared filter definitions (`all`, `common_irrelevant`, `ci_irrelevant`, `e2e_irrelevant`, `skills`).
- **Modify** `.github/workflows/ci.yml` — wrap existing `ci` job with `changes` + `ci-required` jobs.
- **Modify** `.github/workflows/e2e.yml` — wrap existing `e2e` job with `changes` + `e2e-required` jobs; remove the dead `push` trigger.

No source code, no unit tests (CI config). Verification is empirical on a real PR. `.github/*` and `*.md` are in `.prettierignore`, so these files do not affect `format:check`.

---

## Task 1: Create shared filter file

**Files:**
- Create: `.github/path-filters.yml`

- [ ] **Step 1: Write the file**

```yaml
# Shared path filters for CI/E2E job-level gating.
# See docs/superpowers/specs/2026-06-25-ci-e2e-path-gating-design.md
#
# dorny/paths-filter sets picomatch dot:true, so ** matches dotfiles/dot-dirs.
# Gating uses the *_count outputs: a workflow runs iff
#   all_count != <workflow>_irrelevant_count
# i.e. at least one changed file is OUTSIDE the irrelevant set (denylist).
# Forgetting an irrelevant path makes that path count as relevant => the
# workflow runs unnecessarily (the safe failure direction).

# Total changed files.
all:
    - '**'

# Changes that cannot affect ANY check (CI or E2E).
common_irrelevant: &common_irrelevant
    - 'docs/**'
    - 'refs/**'
    - '**/*.md'
    - '.claude/**'
    - '.gemini/**'
    - '.agents/**'
    - '.superpowers/**'
    - '.idea/**'
    - '.vscode/**'
    - '.husky/**'
    - 'LICENSE'

# CI (typecheck/lint/format/test/validate:skills) is irrelevant only for the
# common set. skills are .md and match **/*.md above, so the `skills` filter
# below rescues CI for skills-only changes.
ci_irrelevant: *common_irrelevant

# E2E (prod build + Playwright) is additionally blind to lint/format/unit-test
# tooling and to skills (read at runtime via fs.readdir, not bundled into the
# build). dorny flattens the nested anchor list below (documented behavior).
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

# Rescue: any of these MUST run CI (validate:skills) despite matching **/*.md.
skills:
    - 'skills/**'
    - 'skills-lock.json'
    - 'scripts/validate-skills.ts'
```

- [ ] **Step 2: Validate it parses as YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/path-filters.yml'))" && echo OK`
Expected: `OK`. (Note: `e2e_irrelevant` will parse as a *nested* list `[[...common...], 'skills/**', ...]` — this is expected; dorny flattens it.)

---

## Task 2: Gate ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml` (full rewrite)

- [ ] **Step 1: Replace the whole file**

```yaml
name: CI

on:
    pull_request:
        types: [opened, synchronize, reopened]

concurrency:
    group: ci-${{ github.event.pull_request.number }}
    cancel-in-progress: true

permissions:
    contents: read

jobs:
    # Cheap detect job: decide whether the heavy `ci` job runs. Needs a checkout
    # only to read .github/path-filters.yml; the PR diff comes from the REST API.
    changes:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: read
        outputs:
            run: ${{ steps.gate.outputs.run }}
        steps:
            - uses: actions/checkout@v4
            - uses: dorny/paths-filter@v4
              id: f
              with:
                  filters: .github/path-filters.yml
            # Run CI unless every changed file is CI-irrelevant. skills are .md
            # (inside ci_irrelevant) so rescue CI when any skills file changed.
            - name: Compute gate
              id: gate
              run: |
                  if [ "${{ steps.f.outputs.all_count }}" != "${{ steps.f.outputs.ci_irrelevant_count }}" ] || [ "${{ steps.f.outputs.skills }}" = "true" ]; then
                      echo "run=true" >> "$GITHUB_OUTPUT"
                  else
                      echo "run=false" >> "$GITHUB_OUTPUT"
                  fi

    ci:
        needs: changes
        if: needs.changes.outputs.run == 'true'
        runs-on: ubuntu-latest
        env:
            SIGLENS_GITHUB_TOKEN: ${{ secrets.SIGLENS_GITHUB_TOKEN }}
        permissions:
            contents: read
        steps:
            - uses: actions/checkout@v4

            - name: Enable Corepack
              run: corepack enable

            - uses: actions/setup-node@v4
              with:
                  node-version-file: .nvmrc
                  cache: yarn

            - name: Install dependencies
              run: yarn install --immutable

            - name: Type check
              run: yarn typecheck

            - name: Validate skills
              run: yarn validate:skills

            - name: Lint
              run: yarn lint

            - name: Format check
              run: yarn format:check

            - name: Test
              run: yarn test

    # Required-check gate: always runs so a path-skipped `ci` never leaves a
    # required check stuck "pending". Mark THIS job required (not `ci`).
    ci-required:
        needs: [changes, ci]
        if: always()
        runs-on: ubuntu-latest
        steps:
            - name: Verify CI did not fail
              run: |
                  if [ "${{ needs.changes.result }}" = "failure" ] || [ "${{ needs.changes.result }}" = "cancelled" ]; then
                      echo "detect job failed"; exit 1
                  fi
                  if [ "${{ needs.ci.result }}" = "failure" ] || [ "${{ needs.ci.result }}" = "cancelled" ]; then
                      echo "ci failed"; exit 1
                  fi
                  echo "ci ok (result=${{ needs.ci.result }})"
```

- [ ] **Step 2: Validate it parses as YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
Expected: `OK`

---

## Task 3: Gate e2e.yml + remove dead push trigger

**Files:**
- Modify: `.github/workflows/e2e.yml` (full rewrite — existing `e2e` job steps preserved verbatim)

- [ ] **Step 1: Replace the whole file**

```yaml
name: E2E

on:
    pull_request:

# Least privilege: checkout + upload artifacts. @y0ngha/siglens-core installs
# from npm.pkg.github.com (see .yarnrc.yml) using the SIGLENS_GITHUB_TOKEN
# secret below, NOT the built-in GITHUB_TOKEN — the built-in token cannot read
# this user-scoped GitHub Packages package, so `packages: read` is unused here.
permissions:
    contents: read

# Cancel superseded runs on the same ref to save CI minutes.
concurrency:
    group: e2e-${{ github.event.pull_request.number }}
    cancel-in-progress: true

jobs:
    # Cheap detect job: decide whether the heavy `e2e` job runs. Needs a checkout
    # only to read .github/path-filters.yml; the PR diff comes from the REST API.
    changes:
        runs-on: ubuntu-latest
        permissions:
            contents: read
            pull-requests: read
        outputs:
            run: ${{ steps.gate.outputs.run }}
        steps:
            - uses: actions/checkout@v4
            - uses: dorny/paths-filter@v4
              id: f
              with:
                  filters: .github/path-filters.yml
            # Run E2E unless every changed file is E2E-irrelevant.
            - name: Compute gate
              id: gate
              run: |
                  if [ "${{ steps.f.outputs.all_count }}" != "${{ steps.f.outputs.e2e_irrelevant_count }}" ]; then
                      echo "run=true" >> "$GITHUB_OUTPUT"
                  else
                      echo "run=false" >> "$GITHUB_OUTPUT"
                  fi

    e2e:
        needs: changes
        if: needs.changes.outputs.run == 'true'
        runs-on: ubuntu-latest
        # .yarnrc.yml authenticates the @y0ngha scope to GitHub Packages via
        # ${SIGLENS_GITHUB_TOKEN}; yarn (even `yarn --version`) fails without it.
        # The built-in GITHUB_TOKEN cannot read this user-scoped GitHub Packages
        # package (it 403s), so the repo MUST define a SIGLENS_GITHUB_TOKEN secret
        # (a PAT with read:packages) for CI to install @y0ngha/siglens-core.
        env:
            SIGLENS_GITHUB_TOKEN: ${{ secrets.SIGLENS_GITHUB_TOKEN }}
        # Single job is sufficient for this foundation PR (one smoke spec).
        # When the spec count grows, add Playwright sharding via a matrix
        # (e.g. strategy.matrix.shard: [1, 2] + `--shard=${{ matrix.shard }}/2`).
        steps:
            - name: Checkout repository
              uses: actions/checkout@v4

            # Yarn 4 ships via Corepack; enable it before setup-node so the
            # yarn cache resolves against the project's pinned packageManager.
            - name: Enable Corepack
              run: corepack enable

            - name: Setup Node
              uses: actions/setup-node@v4
              with:
                  node-version-file: '.nvmrc'
                  cache: yarn

            - name: Install dependencies
              run: yarn install --immutable

            - name: Install Playwright browsers
              run: yarn playwright install --with-deps chromium webkit

            # Start the Docker backend with Compose (NOT GitHub `services:`).
            # global-setup.ts runs migrate/seed via `docker compose exec`, which
            # requires a Compose project to exist — `services:` containers have
            # none, so they would break global-setup. This reuses the exact
            # local `e2e:up` path (DRY) and keeps global-setup unmodified.
            - name: Start backend (Docker Compose)
              run: yarn e2e:up

            # Explicit readiness gate before handing off to global-setup's own
            # pg_isready poll — fail fast with logs if a container never goes
            # healthy, rather than timing out deep inside the test run.
            - name: Wait for backend health
              run: |
                  echo "Waiting for Postgres and Redis to report healthy..."
                  for i in $(seq 1 60); do
                      pg_status="$(docker compose -f docker-compose.e2e.yml ps postgres --format '{{.Health}}')"
                      redis_status="$(docker compose -f docker-compose.e2e.yml ps redis --format '{{.Health}}')"
                      echo "attempt $i: postgres=$pg_status redis=$redis_status"
                      if [ "$pg_status" = "healthy" ] && [ "$redis_status" = "healthy" ]; then
                          echo "Backend is healthy."
                          exit 0
                      fi
                      sleep 2
                  done
                  echo "Backend did not become healthy in time. Dumping status + logs:"
                  docker compose -f docker-compose.e2e.yml ps
                  docker compose -f docker-compose.e2e.yml logs
                  exit 1

            # Migrate + seed the e2e DB BEFORE the cold prod build runs. The
            # webServer build statically prerenders /privacy and /terms, which
            # query the `terms` table — so the schema AND active seed rows must
            # exist before `next build`, or the build worker dies with
            # `relation "terms" does not exist` (42P01). This runs the SAME
            # idempotent global-setup (bootstrap + migrate + seed) that
            # test:e2e's globalSetup runs again later; the second run is a no-op.
            - name: Migrate + seed e2e DB
              run: yarn e2e:db

            # CI=1 → reuseExistingServer is false (always cold prod build) and
            # retries: 2. globalSetup runs migrate+seed via compose exec, then
            # the webServer cold-builds the prod app with E2E_TEST=1 sourced from
            # .env.e2e (there is intentionally no .env.local in CI), then runs the
            # chromium + webkit projects.
            - name: Run E2E tests
              run: yarn test:e2e
              env:
                  CI: '1'

            - name: Upload Playwright report
              if: failure()
              uses: actions/upload-artifact@v4
              with:
                  name: playwright-report
                  path: |
                      playwright-report/
                      test-results/
                  retention-days: 7

            # Clean up Docker volumes/containers regardless of outcome.
            - name: Tear down backend
              if: always()
              run: yarn e2e:down

    # Required-check gate: always runs so a path-skipped `e2e` never leaves a
    # required check stuck "pending". Mark THIS job required (not `e2e`).
    e2e-required:
        needs: [changes, e2e]
        if: always()
        runs-on: ubuntu-latest
        steps:
            - name: Verify E2E did not fail
              run: |
                  if [ "${{ needs.changes.result }}" = "failure" ] || [ "${{ needs.changes.result }}" = "cancelled" ]; then
                      echo "detect job failed"; exit 1
                  fi
                  if [ "${{ needs.e2e.result }}" = "failure" ] || [ "${{ needs.e2e.result }}" = "cancelled" ]; then
                      echo "e2e failed"; exit 1
                  fi
                  echo "e2e ok (result=${{ needs.e2e.result }})"
```

- [ ] **Step 2: Confirm the dead push trigger is gone and YAML parses**

Run: `grep -q "feat/e2e-playwright-foundation" .github/workflows/e2e.yml && echo "STILL PRESENT — FAIL" || echo "removed OK"`
Expected: `removed OK`

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/e2e.yml'))" && echo OK`
Expected: `OK`

---

## Task 4: Commit

- [ ] **Step 1: Stage and commit** (delegated to git-agent per repo rules)

```bash
git add .github/path-filters.yml .github/workflows/ci.yml .github/workflows/e2e.yml \
        docs/superpowers/specs/2026-06-25-ci-e2e-path-gating-design.md \
        docs/superpowers/plans/2026-06-25-ci-e2e-path-gating.md
git commit -m "ci: gate CI/E2E on path-filter detect jobs"
```

---

## Verification (empirical — after the PR is open)

The gating logic only evaluates inside a real PR, so verify on the PR itself:

1. **This PR** changes only `.github/**` + `docs/**`. `.github/path-filters.yml` and the workflow files are NOT in any irrelevant set, so **both `ci` and `e2e` run** (the workflow files changed → must validate them). Confirm both run and `ci-required` / `e2e-required` are green.
2. After merge, a **docs-only** follow-up commit/PR should show `ci` and `e2e` **skipped** with `ci-required` / `e2e-required` **success**.
3. A **skills-`.md`-only** PR should run `ci` (validate:skills) and skip `e2e`.
4. A **`src/**`** PR should run both as today.

## Out of Scope

- Marking `ci-required` / `e2e-required` as required status checks in the master ruleset — a GitHub settings change the user makes when ready. This plan makes it safe.
- Step-level gating inside CI and splitting CI into parallel jobs (see spec "Out of Scope").
