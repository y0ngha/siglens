# Issue Implementation Flow

## Orchestration Rules

You (the main orchestrator) own this workflow end-to-end.
You **directly implement** code, then invoke sub-agents for review and git operations.
Never ask the user "shall I proceed?" between steps — route automatically.

### Routing Table

| Signal received | Next action |
|---|---|
| Your implementation complete | Invoke `review-agent` (round 1) |
| `review-agent` · `status: approved` | Invoke `mistake-managing-agent` |
| `review-agent` · `status: changes_requested` | **You** fix findings directly, then re-invoke `review-agent` |
| `review-agent` · `status: loop_limit_reached` | Stop and report to user |
| `mistake-managing-agent` · `status: done` | Invoke `git-agent` |
| `git-agent` · `status: done` | Report PR URL to user and stop |
| Any · `status: failed` | Stop and report the failure reason to user |

---

## Step-by-Step Flow

### Step 1 — Direct Implementation

#### 1-1. Repository

```
REPO=y0ngha/siglens
```

Use this value directly in all `gh` commands.

#### 1-2. Load Required Documents

Always read (targeted):
- `docs/MISTAKES.md` — read only the sections relevant to the task scope:

| Modified layer | MISTAKES.md sections to read |
|---|---|
| domain/ | Coding Paradigm, TypeScript, Domain Functions, Pure Function Contracts |
| infrastructure/ | Coding Paradigm, TypeScript |
| components/ | Coding Paradigm, Components, Design & Cohesion |
| components/chart/ | (above) + Lightweight Charts |
| \_\_tests\_\_/ | Tests |

Multiple layers → read the union of their sections.

Additional documents by scope:
- domain/ related → `docs/DOMAIN.md` + `docs/ARCHITECTURE.md`
- infrastructure/ → `docs/API.md` + `docs/ARCHITECTURE.md`
- components/ → `docs/DESIGN.md` + `docs/ARCHITECTURE.md`
- Layer structure check needed → `docs/ARCHITECTURE.md`

Read existing similar implementations first for pattern recognition:
```bash
# e.g. When implementing MA, check EMA first
# src/domain/indicators/ema.ts
# src/__tests__/domain/indicators/ema.test.ts
```

#### 1-3. Understand the Issue

```bash
gh issue view {number} --repo y0ngha/siglens
```

**If the issue cannot be found, stop and report to user.**

Verify:
- Implementation scope: which layers are touched (domain, infrastructure, app, components)
- File paths to create or modify
- Function signatures and feature specifications
- Reference docs: read only items checked (`[x]`) in the issue body
- Completion criteria

#### 1-4. Create Branch

```bash
git checkout master && git pull origin master
git checkout -b {type}/{issue number}/{one-line summary}
```

Branch naming: `feat/2/도메인-공통-타입-정의`, `refactor/32/candlestick-pattern-domain-분리` format. Korean allowed, spaces replaced with hyphens.

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `refactor` | Code restructuring without behavior change |
| `chore` | Build, config, dependency changes |
| `docs` | Documentation only |
| `test` | Test additions or fixes |
| `style` | Formatting, naming, no logic change |

#### 1-5. Implement Code + Tests

**Domain Layer Checklist** — verify after implementation:
- [ ] No external library imports (technicalindicators, lodash, etc. are all prohibited)
- [ ] Pure functions only (no fetch, console.log, Date.now())
- [ ] Return types must be explicitly declared
- [ ] Initial period values must be null (never 0 or NaN — 0 renders as invalid data in charts)
- [ ] No for/while loops → use map, filter, reduce, flatMap
- [ ] Maintain immutability (no bars.push → use [...bars, newBar])
- [ ] Use path aliases (@/domain/... format)
- [ ] No hardcoded literals → extract to constants (domain/indicators/constants.ts)

**Component Layer Checklist** — verify after implementation:
- [ ] Hook declaration order: useState → useRef → useQuery/useMutation → derived (useMemo/const) → handlers → useLayoutEffect → useEffect → return
- [ ] Props interface directly above component function
- [ ] 'use client' only when hooks, handlers, or browser APIs are used
- [ ] No infrastructure imports in .tsx files (hooks/ may import fetch functions only)
- [ ] No lightweight-charts imports outside components/chart/

**Test Layer Checklist** — verify after implementation:
- [ ] Test file exists for every new domain/infrastructure file
- [ ] 100% branch coverage for infrastructure (all ?., ??, if/else paths)
- [ ] describe/it text is human-readable, not code expressions
- [ ] Period-based indicators include all 5 required test cases
- [ ] No if-guarded assertions (unconditional expect only)

**Infrastructure Layer Checklist** — verify after implementation:
- [ ] No reverse imports (infrastructure → app or domain → infrastructure)
- [ ] Type imports from @/domain/types only
- [ ] No console.log or debug artifacts
- [ ] All conditional branches have dedicated test cases

Only check the checklists for file types you actually modified or created.

**Test writing** — file locations:
```
src/__tests__/domain/indicators/rsi.test.ts
src/__tests__/infrastructure/market/alpaca.test.ts
```

Required test cases for period-based indicators:
- Empty array → return empty array
- Input shorter than period → all null
- Initial null range → first `period - 1` values are null
- Valid value range → non-null numbers after the period-th index
- Calculation accuracy → first computed value matches specification

When creating new files under `domain/indicators/`, add export to `src/domain/indicators/index.ts`.

**Documentation updates** — if the change falls into:

| Change Type | Document to Update |
|---|---|
| New type or interface added | `docs/DOMAIN.md` |
| New indicator implemented | `docs/DOMAIN.md` |
| External API usage changed | `docs/API.md` |
| Layer structure or folder layout changed | `docs/ARCHITECTURE.md` |
| New coding convention established | `docs/CONVENTIONS.md` |

#### 1-6. MISTAKES.md Targeted Self-Review

Before running validation, re-read the MISTAKES.md sections loaded in Step 1-2.
For each modified file, verify every rule in the matching section(s):

| File type | Sections to verify |
|---|---|
| .tsx (component) | Components, Coding Paradigm |
| .ts (domain/) | Domain Functions, TypeScript, Coding Paradigm |
| .ts (infrastructure/) | TypeScript, Coding Paradigm |
| .test.ts | Tests |
| .tsx (chart/) | Components, Lightweight Charts |

**Procedure:**
1. List all files you modified or created.
2. For each file, re-read the matching MISTAKES.md sections.
3. Verify each rule in those sections against the file.
4. Fix any violations found before proceeding.

Do NOT attempt to verify all sections — focus only on the sections
matching the files you actually touched.

#### 1-7. Run Validation Scripts

Run in order. Each must pass before proceeding to the next.

```bash
# Always run — catch style and format issues first
yarn lint
yarn lint:style
yarn format 2>&1 | grep -v "unchanged"
```

```bash
# Run only if .ts or .tsx files were modified
# Use --passWithNoTests to avoid failure when no matching test files exist
git diff --name-only HEAD | grep -E '\.(ts|tsx)$' | xargs -I{} \
  yarn test --testPathPattern={} --passWithNoTests 2>&1 | tail -30
```

```bash
# Always run last — confirms the full build is clean
yarn build 2>&1 | tail -20
```

If any step fails, fix the issue and re-run that step before continuing.

---

### Step 2 — Invoke review-agent (round 1)

```
"Review the code on branch {branch}. This is round 1."
```

Wait for exit signal.

```
status: approved           → proceed to Step 3
status: changes_requested  → proceed to Step 2a
status: loop_limit_reached → stop, report to user
```

#### Step 2a — Findings exist: fix directly

1. Fix both `required` and `recommended` findings directly.
2. **Post-fix Self-Review**: For each file modified during this fix round:
   a. Run the matching checklist from Step 1-5 (Domain/Component/Test/Infrastructure).
   b. Re-read the matching MISTAKES.md sections and verify no new violations
      were introduced by the fix.
   c. When fixing a pattern violation (e.g. hook order), verify the entire
      file for the same pattern — not just the specific line mentioned in the finding.
3. Re-run validation (Step 1-7).
4. Record to fix-log (Step 2b).

#### Step 2b — Record to Fix Log

Append each fix to `docs/__agents_only__/fix-log.md`. Create the file if it does not exist.

**Before recording any entry, check `docs/MISTAKES.md` first.**
If the violation is already documented there (same rule, same pattern), **skip that entry entirely**.
Only record violations that are not yet covered by an existing MISTAKES.md rule.

Format:
```md
## [Issue #{number} | {branch name} | {date YYYY-MM-DD}]
- Violation: {short description of what rule was violated}
- Rule: {which rule from CONVENTIONS.md / MISTAKES.md / FF.md was violated}
- Context: {one sentence describing where and why this happened in the code}
```

Then re-invoke review-agent with round incremented.
**You must include the explicit `modified_files` list** — the files you actually edited during the fix.
review-agent will only read these files, not the full diff.

```
Review the code on branch {branch}. This is round {N}.

Previous round findings (already fixed):
{previous findings JSON}

modified_files (files changed in this fix round):
{list of file paths you edited}

Focus only on modified_files above.
Do not re-review files that were already approved in the previous round.
```

**Loop detection:** After each `changes_requested` signal, compare the new findings against the previous round's findings. If the same `required` finding (same file + same issue description) appears in two consecutive rounds, stop immediately and report to the user.

---

### Step 3 — Invoke mistake-managing-agent

```
"Read docs/__agents_only__/fix-log.md and promote recurring violation patterns to MISTAKES.md."
```

Wait for exit signal.

```
status: done   → proceed to Step 4
status: failed → stop, report to user
```

### Step 4 — Invoke git-agent

```
"Commit the implementation on branch {branch} and open a PR. Issue title: {issue title}"
```

Wait for exit signal.

```
status: done   → report pr_url to user and stop
status: failed → stop, report to user
```
