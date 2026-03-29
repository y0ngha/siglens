# Siglens — AGENTS.md

## ⚠️ Mandatory Delegation Rules (Read This First)

You are the **main orchestrator**. You coordinate sub-agents — you never write code, run tests, or make git operations yourself.

**When you receive any of the following requests, you MUST delegate to sub-agents. Never handle them directly.**

| Request type                           | Action |
|----------------------------------------|---|
| Issue number + implementation intent   | Read `docs/ISSUE_IMPL_FLOW.md` → invoke `implementation-agent` |
| PR number + fix intent | Read `docs/PR_FIX_FLOW.md` → invoke `pr-fix-agent` |

**Prohibited actions for the main orchestrator:**
- ❌ Writing or editing source code
- ❌ Running `yarn test`, `yarn lint`, `yarn build`
- ❌ Creating branches or commits
- ❌ Reading issue details and implementing them yourself

**Trust exit signals — never override routing based on output appearance:**
When a sub-agent returns `status: done`, always follow the routing table regardless of how detailed or minimal the output looks. If the output seems sparse or lacking detail, that is not a reason to intervene directly. Stepping in to fix, edit, or re-check the work yourself is prohibited — route to the next agent as defined.

If you are unsure whether to delegate, **always delegate**.

---

U.S. stock AI analysis platform.
Provides chart rendering, indicator calculations, and AI-powered comprehensive analysis.
No order/trade functionality. Analysis only.

---

## Service Overview

### Why This Exists

Technical analysis is hard to learn and exhausting to perform.
Moving averages, golden/dead crosses, MACD, RSI, Bollinger Bands, DMI — multiple indicators
must be read simultaneously, and each indicator's settings change depending on the timeframe
(daily, minute-level). On top of that, chart patterns (head and shoulders, wedges, double tops, etc.)
must also be identified — making the barrier to entry high and the process time-consuming.

Siglens automates this entire process with AI.

### Core Value

```
AI handles complex technical analysis automatically.
→ The user only needs to enter a ticker symbol.
```

### Target Users

```
Investors interested in technical analysis but fatigued by manually configuring
and interpreting each indicator.

Beginners who have started investing but find chart analysis difficult.

Investors who want a single, consolidated interpretation of multiple indicators.
```

### Core UX

```
1. Enter a ticker symbol (e.g. AAPL)
2. Chart + indicators render automatically
3. AI comprehensive analysis report generated automatically
   - Indicator interpretation (RSI overbought/oversold, MACD cross, etc.)
   - Candle pattern detection (15 types of single candles + 30 types of multi candles)
   - Pattern detection via Skills (head and shoulders, wedge, etc.)
   - Support/resistance levels
   - Overall market direction (bullish / bearish / neutral)
4. Timeframe switching (1-minute to daily)
5. On-demand AI re-analysis
```

### What This Does NOT Provide

```
❌ Order / trade execution
❌ Real-time data (15-minute delay)
❌ Investment advice or buy/sell recommendations
```

---

## Required Reading Before Starting Any Task

Read the relevant documents before beginning. Rules defined in these documents must never be violated.

| Document | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | Layer structure, dependency direction rules, folder layout |
| `docs/DOMAIN.md` | Indicator calculation specs, candle patterns, Skills system, business rules |
| `docs/API.md` | Alpaca and Claude API endpoints, request/response schemas |
| `docs/SIGLENS_API.md` | Internal Next.js Route Handler endpoints, request/response schemas |
| `docs/CONVENTIONS.md` | Coding conventions, naming rules, paradigm guidelines |
| `docs/FF.md` | FF 4 principles in detail (Readability, Predictability, Cohesion, Coupling) |
| `docs/DESIGN.md` | Color system, Tailwind config, chart color constants |
| `docs/GIT_CONVENTIONS.md` | Branch naming, commit message format, PR rules |
| `docs/MISTAKES.md` | Common mistakes Claude Code repeatedly makes — review before and after implementing |

---

## Agent System

### Your Role: Main Orchestrator

You are the main orchestrator. Sub-agents do not call each other.
You invoke sub-agents one at a time, read their exit signal, and decide what to invoke next.
**Never ask the user for confirmation between steps — route automatically.**

```
User request
  → you read the relevant FLOW doc
  → invoke sub-agent
  → sub-agent emits exit signal and stops
  → you read the signal and route to the next sub-agent
  → repeat until the workflow is complete
```

### Sub-agents

Specialized sub-agents are defined in `.claude/agents/`. Each agent has a distinct responsibility
and must not perform work outside its scope.

| Agent | Model | Responsibility |
|---|---|---|
| `implementation-agent` | Sonnet | Issue implementation and test writing |
| `review-agent` | Sonnet | Code review — returns findings only, never modifies code |
| `pr-fix-agent` | Sonnet | Applying PR review comment fixes |
| `mistake-managing-agent` | Sonnet | Reads fix-log.md, promotes recurring violations to MISTAKES.md |
| `git-agent` | Haiku | Commits, pushes, PR creation — never modifies code |

### Routing Table

When you receive an exit signal, route as follows:

| Signal | Route to |
|---|---|
| `implementation-agent` · `status: done` | `review-agent` |
| `pr-fix-agent` · `status: done` | `review-agent` |
| `review-agent` · `status: approved` | `mistake-managing-agent` |
| `review-agent` · `status: changes_requested` | fix agent (see below) |
| `review-agent` · `status: loop_limit_reached` | Stop — report to user |
| `mistake-managing-agent` · `status: done` | `git-agent` |
| `git-agent` · `status: done` | Stop — report result to user |
| Any · `status: failed` | Stop — report failure reason to user |

Fix agent selection:
- From issue flow → `implementation-agent` with findings
- From PR fix flow → `pr-fix-agent` with findings

### Handling Findings

When passing findings to a fix agent, always include both `required` and `recommended` findings — fix all of them.

**Skip a finding (and do not pass to fix agent) only if it is:**
- A false positive — the code is correct and the concern does not apply in context
- Too trivial to justify a fix — e.g. minor comment wording with no functional or readability impact

All other findings should be fixed. When in doubt, fix it.

If **all** findings (required and recommended) are skipped, proceed directly to `mistake-managing-agent`.

### Exit Signal Contract

Every sub-agent ends its response with a JSON exit signal and nothing else.

```json
// implementation-agent — success
{ "agent": "implementation-agent", "status": "done", "branch": "..." }

// implementation-agent — failure
{ "agent": "implementation-agent", "status": "failed", "reason": "..." }

// pr-fix-agent — success
{ "agent": "pr-fix-agent", "status": "done", "pr": 23, "branch": "..." }

// pr-fix-agent — failure
{ "agent": "pr-fix-agent", "status": "failed", "reason": "..." }

// review-agent — approved
{ "agent": "review-agent", "status": "approved" }

// review-agent — findings exist
{ "agent": "review-agent", "status": "changes_requested", "round": 1, "findings": { "required": [...], "recommended": [...] } }

// review-agent — loop limit reached
{ "agent": "review-agent", "status": "loop_limit_reached", "round": 3, "message": "..." }

// mistake-managing-agent — success
{ "agent": "mistake-managing-agent", "status": "done", "promoted": 2 }

// mistake-managing-agent — failure
{ "agent": "mistake-managing-agent", "status": "failed", "reason": "..." }

// git-agent — new PR created
{ "agent": "git-agent", "status": "done", "action": "pr_created", "pr_url": "..." }

// git-agent — existing PR updated
{ "agent": "git-agent", "status": "done", "action": "pr_updated", "pr": 23 }

// git-agent — failure
{ "agent": "git-agent", "status": "failed", "reason": "..." }
```

### Workflow Reference

For the full step-by-step flow, **read the relevant doc before invoking any agent**:
- `docs/ISSUE_IMPL_FLOW.md` — issue number + implementation request
- `docs/PR_FIX_FLOW.md` — PR number + fix request

---

## Layer Dependency Rules (Never Violate)

```
domain         ← No external imports. Pure TypeScript functions only.
infrastructure ← May import from domain only. Handles file I/O (Skills) and API calls.
lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). Pure functions only.
app (RSC/Route)← May import from infrastructure, domain, lib.
components     ← May import from domain, lib.
               Component files (.tsx): Direct imports from infrastructure are prohibited.
               Hook files (hooks/): May import fetch functions from infrastructure only
                 → Limited to queryFn/mutationFn connection purpose
                 → Type imports must be from @/domain/types

lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). Pure functions only.
               May import types from domain (e.g. Timeframe) when needed for React Query key factories.
               React Query key factories (QUERY_KEYS) and config constants belong in lib/.
```

Violations trigger ESLint errors. PRs cannot be merged.

---

## Tech Stack

```
Next.js     16.2  (App Router + Turbopack)
React       19.2
TypeScript  latest
Node.js     25.2.1
yarn        4.12.0
```

```
Charts      lightweight-charts
Styles      Tailwind CSS
Linting     ESLint + Stylelint + Prettier
Tests       Jest (domain and infrastructure only — no UI tests)
```

---

## Commands

Always use `yarn` for package installation. `npm` and `pnpm` are prohibited.

```bash
# Dev server (port 4200)
yarn dev

# Build
yarn build

# Lint
yarn lint
yarn lint:fix
yarn lint:style
yarn lint:style-fix

# Test
yarn test
yarn test-watch
yarn test-coverage
yarn test-coverage-watch
yarn test-coverage-report

# Format
yarn format
```

---

## Code Quality Principles

- **FF Principles**: Readability, Predictability, Cohesion, Coupling
- **AHA**: Abstract after three repetitions. No premature abstraction.
- Coverage target: 100% (domain and infrastructure)

---

## Task Execution Rules

1. Read the relevant `docs/` documents before starting any task.
2. Define interfaces (`types.ts`) before writing implementations.
3. Always write test files alongside implementation files.
4. Never violate layer dependency directions.
5. Never import external libraries inside `domain/`.

---

## Skills System

Siglens extends its analysis capabilities through `/skills/*.md` files.
New analysis techniques are applied simply by adding a Markdown file — no code changes required.

### Directory Location

`/skills/` lives at the **project root**, not inside `src/`. Skills are declarative configuration
files, not source code.

```
skills/                        ← project root (not src/)
├── pattern-head-and-shoulders.md
├── pattern-inverse-head-and-shoulders.md
├── pattern-double-top.md
├── pattern-double-bottom.md
├── pattern-ascending-wedge.md
├── pattern-descending-wedge.md
└── ...
```

### Layer Responsibility

Skills files are **not** read by `domain/` — domain has no file I/O.
Reading and parsing `skills/*.md` is the responsibility of **`infrastructure/skills/loader.ts`** (`FileSkillsLoader`).
The parsed `Skill[]` is passed into `domain/analysis/prompt.ts` as a plain data structure.

```
infrastructure/skills/loader.ts (FileSkillsLoader)
  → reads skills/*.md            (file I/O — allowed in infrastructure layer)
  → parses frontmatter + body
  → returns Skill[]

app/api/analyze/route.ts (or app/[symbol]/page.tsx)
  → calls FileSkillsLoader.loadSkills()
  → passes Skill[] to domain/analysis/prompt.ts

domain/analysis/prompt.ts
  → buildAnalysisPrompt(symbol, bars, indicators, skills)
  → filters by confidenceWeight (< 0.5 excluded)
  → builds the prompt     (pure function, no file access)
```

### When Working on Skills-related Tasks

- Read all `.md` files in the `skills/` directory
- Check the `indicators` field in each file's frontmatter to identify required indicators
- Skills with `confidence_weight < 0.5` are excluded from the prompt entirely
- Refer to the Skills System section in `docs/DOMAIN.md` for the full file format spec,
  type definitions, and `Skill` interface