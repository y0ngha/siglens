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

| Modified area | MISTAKES.md sections to read |
|---|---|
| Indicator calculations, signal logic, candle patterns, or prompt builders | Coding Paradigm, Domain Functions |
| UI components (.tsx) | Components |
| TypeScript type definitions | TypeScript |
| Test files | Tests |
| SEO / structured data | SEO & Semantic Markup |
| Accessibility / ARIA | Accessibility (WAI-ARIA) |
| All other changes | Coding Paradigm (general) |

Determine the area by reading the diff content — use the active FSD layers (`app`, `widgets`, `features`, `entities`, `shared`) rather than legacy directory names.

Multiple areas → read the union of their sections.

Additional documents based on fix scope:
- Indicator / signal / candle pattern / prompt logic → `docs/DOMAIN.md`
- External API integration → `docs/API.md`
- UI components → `docs/DESIGN.md`

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
# Tip: Use `[-1:]` (descending, limit 1) to quickly confirm whether any new review exists before doing a full parse.
# Example quick-check: gh api repos/y0ngha/siglens/pulls/{PR number}/reviews | jq '.[-1] | {state, submitted_at, body_preview: .body[:120]}'
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

#### 1-6a. Oscillation Detection (escalate to user)

**Trigger**: Before applying any fix, check whether the comment **reverses** a fix you applied in an earlier round of the same PR. If so, **stop and ask the user** before touching code.

This rule exists because automated reviewers (bot reviewers especially) sometimes give contradictory advice across rounds — telling you to move a file from `A` to `B` in one round, then from `B` back to `A` in the next. Each oscillation cycle is wasted effort; some user judgment is needed to decide which side of the loop to honor.

**How to detect**:
1. Read `docs/__agents_only__/fix-log.md` for the same PR number before triaging the new round.
2. For each new review comment, check whether **the same file or symbol** was the subject of a prior round's fix.
3. Flag as oscillation when the new comment's directive contradicts the prior fix's outcome:
   - "Move X to lib/" earlier ↔ "Move X out of lib/" now
   - "Add @internal" earlier ↔ "Remove @internal" now
   - "Compress JSDoc" earlier ↔ "Expand to multi-line for clarity" now
   - "Rename A to B" earlier ↔ "B is wrong, use C" now (where the original A would still be valid)

**Other red flags from the reviewer that warrant escalation** (not strict oscillation, but related fact-confusion):
- Reviewer cites a previous round number that did not actually contain the claimed decision (fabricated history)
- Reviewer cites a rule from `MISTAKES.md` / `CONVENTIONS.md` that does not exist or says the opposite

**What to do when oscillation is detected**:
1. **Do not apply the conflicting fix.**
2. Pause and report to the user with this template:
   > 🚨 **Oscillation 발견 — R{N-1}와 R{N}가 충돌합니다**
   >
   > **R{N-1}** (적용됨): "{이전 라운드 reviewer 권고와 적용 결과 1줄}"
   >
   > **R{N}** (지금): "{이번 라운드 reviewer 권고 1줄}"
   >
   > 이 항목을 ① 이번 라운드 권고대로 되돌릴지, ② 무시하고 R{N-1} 결정을 유지할지, ③ 별도 결정이 필요한지 알려주세요.
3. Apply non-conflicting blockers/suggestions in the same round normally; only the oscillation item is paused.
4. Record the user's decision in `fix-log.md` so the next round can reference it.

**Do not** silently apply a fix that reverses a prior round even if it sounds reasonable — the cost is one user message; the benefit is preventing infinite ping-pong loops.

#### 1-7. Apply Fixes

Read all comments first, then apply all fixes in a single pass.

After applying, verify against the checklist matching each modified file type:

**Pure Logic / Core Boundary Checklist:**
- [ ] No external library imports (technicalindicators, lodash, etc.)
- [ ] Pure functions only (no fetch, console.log, Date.now())
- [ ] Return types explicitly declared
- [ ] Initial period values must be null (never 0 or NaN)
- [ ] No for/while loops → use map, filter, reduce, flatMap
- [ ] Maintain immutability (no push, reverse, sort — use spread, toReversed)
- [ ] Use path aliases or `@y0ngha/siglens-core` public exports only
- [ ] No hardcoded literals → extract to constants

**UI Layer Checklist:**
- [ ] Hook declaration order: useState → useRef → useQuery/useMutation → derived (useMemo/const) → handlers → useLayoutEffect → useEffect → return
- [ ] Props interface directly above component function
- [ ] 'use client' only when hooks, handlers, or browser APIs are used
- [ ] No server-only imports in client components
- [ ] No lightweight-charts imports outside chart widgets/components

**Test Layer Checklist:**
- [ ] Test file exists for every new behavior that affects measured FSD layers
- [ ] Coverage remains aligned with the project target: 90% across measured FSD layers
- [ ] New conditional branches (`?.`, `??`, if/else, error paths) have dedicated test cases
- [ ] describe/it text is human-readable, not code expressions
- [ ] Period-based indicators include all 5 required test cases
- [ ] No if-guarded assertions (unconditional expect only)

**Data / API Adapter Checklist:**
- [ ] No reverse imports against FSD dependency direction
- [ ] Server-only code stays in actions/api/shared server utilities, not client components
- [ ] No console.log or debug artifacts
- [ ] All conditional branches have dedicated test cases

Only check the checklists for file types you actually modified.

#### 1-7a. MISTAKES.md Targeted Self-Review

For each file modified during the fix:

1. Re-read the matching MISTAKES.md sections:

   | File type | Sections to read |
   |---|---|
   | .tsx (component) | Components, Coding Paradigm |
   | .ts pure logic | Domain Functions, TypeScript, Coding Paradigm |
   | .ts action/api/adapter | TypeScript, Coding Paradigm |
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
  yarn test {} --passWithNoTests 2>&1 | tail -30
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
