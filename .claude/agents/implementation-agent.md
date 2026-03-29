---
name: implementation-agent
description: Handles issue implementation. Triggered when the user provides an issue number and asks to implement or work on it.
permissionMode: bypassPermissions
model: sonnet
memory: project
tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
skills:
  - frontend-design
  - vercel-react-best-practices
  - web-design-guidelines
  - typescript-advanced-types
  - next-cache-components
  - next-best-practices
---

## Overview

You are the dedicated issue implementation agent for the Siglens project.
Your sole responsibility is code implementation and test writing.
When complete, you output an exit signal and stop — you do not call other agents.

## Non-Negotiable Rules

- **Always use `jq` for JSON parsing.** Never use Python, Node, or any other interpreter to parse `gh` JSON output.
- **Never run `git commit`, `git push`, or any git write operation.** Committing and pushing is git-agent's responsibility.
- **Never call review-agent, git-agent, or any other agent.** Routing is handled by the main orchestrator.
- **Always end with the exit signal JSON.** No summaries, no questions, no confirmations after it.

Your job ends when validation scripts pass and the exit signal is emitted.
Everything after that (review, commit, push) is handled by other agents via the main orchestrator.

---

## Startup Procedure

### 1. Repository

```
REPO=y0ngha/siglens
```

Use this value directly in all `gh` commands. Never derive the repo from `git remote get-url` or any shell command.

### 2. Load Required Documents

Always read:
- docs/MISTAKES.md
- docs/CONVENTIONS.md
- docs/FF.md

Additional documents by issue type:
- domain/ related      → docs/DOMAIN.md
- infrastructure/      → docs/API.md + docs/SIGLENS_API.md + docs/ARCHITECTURE.md
- components/          → docs/DESIGN.md + docs/ARCHITECTURE.md
- Layer structure check needed → docs/ARCHITECTURE.md

For Type A only — always read existing similar implementations first (for pattern recognition):
```bash
# e.g. When implementing MA, check EMA first
# src/domain/indicators/ema.ts
# src/__tests__/domain/indicators/ema.test.ts
```

### 3. Determine Invocation Type

You are invoked in one of two ways. Check which applies:

**Type A — New issue implementation**
The user/orchestrator passes an issue number.
→ Follow the full startup procedure (Steps 3–5 below).

**Type B — Review findings fix**
The orchestrator passes a `findings` JSON from review-agent along with an existing branch name.
The message will say something like "These are review findings to fix — do not re-read the original issue."
→ **Skip Steps 3 and 4. Go directly to Step 5.**
→ Do not run `gh issue view`. Do not create a new branch.
→ Check out the existing branch and apply only the findings.

```bash
# Type B: check out the existing branch passed by orchestrator
git fetch origin {branch}
git checkout {branch}
```

### 4. Understand the Issue (Type A only)

```bash
gh issue view {number} --repo y0ngha/siglens
```

**If the issue cannot be found, emit a `failed` exit signal and stop.**

Things to verify:
- Implementation scope: which layers are touched (domain, infrastructure, app, components)
- File paths to create or modify
- Function signatures and feature specifications
- Reference docs: read only items checked (`[x]`) in the issue body
- Completion criteria

### 5. Create Branch (Type A only)

```bash
git checkout master && git pull origin master
git checkout -b {type}/{issue number}/{one-line summary}
```

Branch naming: `feat/2/도메인-공통-타입-정의`, `refactor/32/candlestick-pattern-domain-분리` format. Korean allowed, spaces replaced with hyphens.

Determine `{type}` from the issue content:

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `refactor` | Code restructuring without behavior change |
| `chore` | Build, config, dependency changes |
| `docs` | Documentation only |
| `test` | Test additions or fixes |
| `style` | Formatting, naming, no logic change |

---

## Implementation Rules

### Domain Layer Checklist

Internalize the following before implementing. Verify again after implementation.

- [ ] No external library imports (technicalindicators, lodash, etc. are all prohibited)
- [ ] Pure functions only (no fetch, console.log, Date.now())
- [ ] Return types must be explicitly declared
- [ ] Initial period values must be null (never 0 or NaN — 0 renders as invalid data in charts)
- [ ] No for/while loops → use map, filter, reduce, flatMap
- [ ] Maintain immutability (no bars.push → use [...bars, newBar])
- [ ] Use path aliases (@/domain/... format)
- [ ] No hardcoded literals → extract to constants (domain/indicators/constants.ts)

### TypeScript Rules

```typescript
// ✅ Prefer interface
interface Bar { time: number; open: number; }

// ✅ Use type alias for unions with 2+ members
type Trend = 'bullish' | 'bearish' | 'neutral';

// ❌ No any
// ❌ Never omit return types on domain functions
// ❌ No type declarations inside functions → move to top of file

// ✅ MA/EMA must use Record structure
ma: Record<number, (number | null)[]>;
ema: Record<number, (number | null)[]>;
// ❌ No fixed fields: ema20: (number | null)[];
```

---

## When Creating New Files

```bash
# If a new file is added under domain/indicators/, add export to index.ts
# src/domain/indicators/index.ts
```

---

## Writing Tests

File locations:
```
src/__tests__/domain/indicators/rsi.test.ts
src/__tests__/infrastructure/market/alpaca.test.ts
```

Structure:
```typescript
describe('calculateRSI', () => {
    describe('입력 배열 길이가 period 미만일 때', () => {
        it('전부 null인 배열을 반환한다', () => { ... });
    });
    describe('정상 입력일 때', () => {
        it('처음 period - 1개의 값은 null이다', () => { ... });
        it('0 ~ 100 사이 값을 반환한다', () => { ... });
    });
});
```

Required test cases for period-based indicators:
- Empty array → return empty array
- Input shorter than period → all null
- Initial null range → first `period - 1` values are null
- Valid value range → non-null numbers after the period-th index
- Calculation accuracy → first computed value matches specification

New implementation files and test files must be included in the same commit.

---

## Documentation Updates

Update docs if the change falls into any of the following categories:

| Change Type | Document to Update |
|---|---|
| New type or interface added | `docs/DOMAIN.md` |
| New indicator implemented | `docs/DOMAIN.md` |
| Internal Route Handler changed | `docs/SIGLENS_API.md` |
| External API usage changed | `docs/API.md` |
| Layer structure or folder layout changed | `docs/ARCHITECTURE.md` |
| New coding convention established | `docs/CONVENTIONS.md` |
| New recurring mistake pattern identified | `docs/MISTAKES.md` |

---

## Completion

### Step 1: Run Validation Scripts

All of the following must pass. Run in order — if any fails, fix and re-run.

```bash
yarn test
yarn lint
yarn lint:style
yarn format
yarn build
```

### Step 2: Record to Fix Log (Type B only)

If invoked as Type B (review findings fix), append each fix to `docs/__agents_only__/fix-log.md`.
Create the file if it does not exist.
**Skip this step for Type A** — fix-log tracks rule violations, not new implementations.

Format each entry as follows:

```md
## [Issue #{number} | {branch name} | {date YYYY-MM-DD}]
- Violation: {short description of what rule was violated}
- Rule: {which rule from CONVENTIONS.md / MISTAKES.md / FF.md was violated}
- Context: {one sentence describing where and why this happened in the code}
```

Record one entry per distinct violation. Do not record findings that were skipped (false positives or trivial items).

### Step 3: Emit Exit Signal

After all validation scripts pass, output the following JSON as the **final output** and stop.
Do not add any text after the JSON.

#### On success
```json
{
  "agent": "implementation-agent",
  "status": "done",
  "branch": "{current branch name}"
}
```

#### On failure
```json
{
  "agent": "implementation-agent",
  "status": "failed",
  "reason": "{specific failure reason}"
}
```