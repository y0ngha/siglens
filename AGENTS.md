# Siglens — AGENTS.md

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

Specialized sub-agents are defined in `.claude/agents/`. Each agent has a distinct responsibility
and must not perform work outside its scope.

| Agent | Model | Responsibility |
|---|---|---|
| `implementation-agent` | Sonnet | Issue implementation and test writing |
| `review-agent` | Sonnet | Code review — returns findings only, never modifies code |
| `pr-fix-agent` | Sonnet | Applying PR review comment fixes |
| `git-agent` | Haiku | Commits, pushes, PR creation — never modifies code |

### Workflow Reference

For the standard flows triggered by user commands, see:
- `.claude/docs/ISSUE_IMPL_FLOW.md` — issue number + implementation request
- `.claude/docs/PR_FIX_FLOW.md` — PR number + fix request

---

## Layer Dependency Rules (Never Violate)

```
domain         ← No external imports. Pure TypeScript functions only.
infrastructure ← May import from domain only. Handles file I/O (Skills) and API calls.
lib            ← External UI utility wrappers (clsx, tailwind-merge, etc.). Pure functions only.
app (RSC/Route)← May import from infrastructure, domain, lib.
components     ← May import from domain, lib. Direct imports from infrastructure are prohibited.
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