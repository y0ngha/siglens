# PR Fix Flow

## Orchestration Rules

You (the main orchestrator) own this workflow end-to-end.
You **directly fix** PR review comments, then invoke sub-agents for mistake management and git operations.
Never ask the user "shall I proceed?" between steps — route automatically.

### Routing Table

| Signal received | Next action |
|---|---|
| Your fixes complete | Invoke `mistake-managing-agent` |
| `mistake-managing-agent` · `status: done` | Invoke `git-agent` |
| `git-agent` · `status: done` | Report completion to user and stop |
| Any · `status: failed` | Stop and report the failure reason to user |

---

## Step-by-Step Flow

### Step 1 — Direct PR Fix

#### 1-1. Repository

```
REPO=y0ngha/siglens
```

Use this value directly in all `gh` commands.

#### 1-2. Load Required Documents

Always read (targeted):
- `docs/MISTAKES.md` — read only the sections relevant to the fix scope:

| Modified layer | MISTAKES.md sections to read |
|---|---|
| domain/ | Coding Paradigm, TypeScript, Domain Functions, Pure Function Contracts |
| infrastructure/ | Coding Paradigm, TypeScript, Layer Dependencies |
| components/ | Coding Paradigm, Components, Design & Cohesion |
| components/chart/ | (above) + Lightweight Charts |
| \_\_tests\_\_/ | Tests |
| ESLint/format issues | ESLint |

Multiple layers → read the union of their sections.

Additional documents based on fix scope:
- domain/ related → `docs/DOMAIN.md`
- infrastructure/ → `docs/API.md`
- components/ → `docs/DESIGN.md`

#### 1-3. Understand PR Context

```bash
gh pr view {PR number} --repo y0ngha/siglens
```

**If the PR cannot be found, stop and report to user.**

#### 1-4. Check Out Head Branch

```bash
# Get head branch name
gh pr view {PR number} --json headRefName --repo y0ngha/siglens | jq -r '.headRefName'

git fetch origin '{head branch name}'
git checkout '{head branch name}'
```

#### 1-5. Fetch Review Comments After the Latest Commit

Always use `jq` for JSON parsing. Never use `$()` command substitution — store intermediate values to a temp file instead.

```bash
# Step 1: Save the latest commit timestamp to a temp file
gh api repos/y0ngha/siglens/pulls/{PR number}/commits \
  | jq -r '.[-1].commit.committer.date' > /tmp/latest_commit_date.txt

# Step 2: Filter inline comments created after the latest commit
gh api repos/y0ngha/siglens/pulls/{PR number}/comments \
  | jq --rawfile since /tmp/latest_commit_date.txt \
    '[.[] | select(.created_at > ($since | rtrimstr("\n"))) | {id: .id, path: .path, line: .line, body: .body}]'

# Step 3: Filter reviews submitted after the latest commit
gh api repos/y0ngha/siglens/pulls/{PR number}/reviews \
  | jq --rawfile since /tmp/latest_commit_date.txt \
    '[.[] | select(.submitted_at > ($since | rtrimstr("\n"))) | {id: .id, state: .state, submitted_at: .submitted_at, body: .body}]'

# Step 4: Only fetch per-review inline comments when Step 3 body is empty AND inline context (path/line) is required
gh api repos/y0ngha/siglens/pulls/{PR number}/reviews/{review_id}/comments \
  | jq '[.[] | {path: .path, line: .line, body: .body}]'
```

If no comments exist after the latest commit, stop and report to user — there is nothing to fix.

#### 1-6. Comment Triage

**Do not apply fixes immediately.** Evaluate every comment before touching any code.

Reject a comment (do not apply the fix) if any of the following is true:

1. **Conflicts with CONVENTIONS.md** — Convention takes precedence.
2. **Violates FF Principles** — Applying the change would degrade Readability, Predictability, Cohesion, or Coupling.
3. **Breaks Layer Architecture** — Violates dependency rules in `docs/ARCHITECTURE.md`.
4. **Matches a Known Mistake Pattern** — Already documented in `docs/MISTAKES.md` as a pattern to avoid.
5. **Reviewer Lacks Project Context** — Unaware of an intentional design decision or constraint.

For every rejected comment, post a reply on GitHub:
```bash
gh api repos/y0ngha/siglens/pulls/comments/{comment_id}/replies \
  -X POST \
  -f body="This review comment will not be applied. {rejection reason}"
```

#### 1-7. Apply Fixes

Read all comments first, then apply all fixes in a single pass.

After applying, verify against the checklist matching each modified file type:

**Domain Layer Checklist:**
- [ ] No external library imports (technicalindicators, lodash, etc.)
- [ ] Pure functions only (no fetch, console.log, Date.now())
- [ ] Return types explicitly declared
- [ ] Initial period values must be null (never 0 or NaN)
- [ ] No for/while loops → use map, filter, reduce, flatMap
- [ ] Maintain immutability (no push, reverse, sort — use spread, toReversed)
- [ ] Path aliases (@/domain/... format)
- [ ] No hardcoded literals → extract to constants

**Component Layer Checklist:**
- [ ] Hook declaration order: useState → useRef → useQuery/useMutation → derived (useMemo/const) → handlers → useLayoutEffect → useEffect → return
- [ ] Props interface directly above component function
- [ ] 'use client' only when hooks, handlers, or browser APIs are used
- [ ] No infrastructure imports in .tsx files (hooks/ may import fetch functions only)
- [ ] No lightweight-charts imports outside components/chart/

**Test Layer Checklist:**
- [ ] Test file exists for every new domain/infrastructure file
- [ ] 100% branch coverage for infrastructure (all ?., ??, if/else paths)
- [ ] describe/it text is human-readable, not code expressions
- [ ] Period-based indicators include all 5 required test cases
- [ ] No if-guarded assertions (unconditional expect only)

**Infrastructure Layer Checklist:**
- [ ] No reverse imports (infrastructure → app or domain → infrastructure)
- [ ] Type imports from @/domain/types only
- [ ] No console.log or debug artifacts
- [ ] All conditional branches have dedicated test cases

Only check the checklists for file types you actually modified.

#### 1-7a. MISTAKES.md Targeted Self-Review

For each file modified during the fix:

1. Re-read the matching MISTAKES.md sections:

   | File type | Sections to read |
   |---|---|
   | .tsx (component) | Components, Coding Paradigm |
   | .ts (domain/) | Domain Functions, TypeScript, Coding Paradigm |
   | .ts (infrastructure/) | TypeScript, Layer Dependencies |
   | .test.ts | Tests |
   | .tsx (chart/) | Components, Lightweight Charts |

2. Verify each rule in those sections against the modified file.
3. When fixing a pattern violation, verify the entire file for the same pattern —
   not just the specific location mentioned in the review comment.
4. Fix any violations found before proceeding to validation.

#### 1-8. Run Validation Scripts

Run in order. Each must pass before proceeding.

```bash
# Always run
yarn lint
yarn lint:style
yarn format 2>&1 | grep -v "unchanged"
```

```bash
# Run only if .ts or .tsx files were modified
git diff --name-only HEAD | grep -E '\.(ts|tsx)$' | xargs -I{} \
  yarn test --testPathPattern={} --passWithNoTests 2>&1 | tail -30
```

```bash
# Always run last
yarn build 2>&1 | tail -20
```

If any step fails, fix the issue and re-run.

#### 1-9. Record to Fix Log

Append each fix to `docs/__agents_only__/fix-log.md`. Create the file if it does not exist.

**Before recording any entry, check `docs/MISTAKES.md` first.**
If the violation is already documented there, **skip that entry entirely**.

Format:
```md
## [PR #{number} | {branch name} | {date YYYY-MM-DD}]
- Violation: {short description of what rule was violated}
- Rule: {which rule from CONVENTIONS.md / MISTAKES.md / FF.md was violated}
- Context: {one sentence describing where and why this happened in the code}
```

Record one entry per distinct violation. Rejected comments are not recorded.

---

### Step 2 — Invoke mistake-managing-agent

```
"Read docs/__agents_only__/fix-log.md and promote recurring violation patterns to MISTAKES.md."
```

Wait for exit signal.

```
status: done   → proceed to Step 3
status: failed → stop, report to user
```

### Step 3 — Invoke git-agent

```
"Commit and push the fixes on branch {branch} for PR #{N}."
```

Wait for exit signal.

```
status: done   → report completion to user and stop
status: failed → stop, report to user
```
