# Service Overview

U.S. stock AI analysis platform.
Provides chart rendering, indicator calculations, and AI-powered comprehensive analysis.
No order/trade functionality. Analysis only.

---

## Why This Exists

Technical analysis is hard to learn and exhausting to perform.
Moving averages, golden/dead crosses, MACD, RSI, Bollinger Bands, DMI — multiple indicators
must be read simultaneously, and each indicator's settings change depending on the timeframe
(daily, minute-level). On top of that, chart patterns (head and shoulders, wedges, double tops, etc.)
must also be identified — making the barrier to entry high and the process time-consuming.

Siglens automates this entire process with AI.

## Core Value

```
AI handles complex technical analysis automatically.
→ The user only needs to enter a ticker symbol.
```

## Target Users

```
Investors interested in technical analysis but fatigued by manually configuring
and interpreting each indicator.

Beginners who have started investing but find chart analysis difficult.

Investors who want a single, consolidated interpretation of multiple indicators.
```

## Core UX

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

## What This Does NOT Provide

```
❌ Order / trade execution
❌ Real-time data (15-minute delay)
❌ Investment advice or buy/sell recommendations
```

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

## Skills System

Siglens extends its analysis capabilities through `.md` files inside `/skills/` and its subdirectories.
New analysis techniques are applied simply by adding a Markdown file — no code changes required.

### Directory Location

`/skills/` lives at the **project root**, not inside `src/`. Skills are declarative configuration
files, not source code.

```
skills/                        ← project root (not src/)
├── patterns/
│   ├── head-and-shoulders.md
│   ├── inverse-head-and-shoulders.md
│   ├── double-top.md
│   ├── double-bottom.md
│   ├── ascending-wedge.md
│   └── descending-wedge.md
├── indicators/
│   └── (향후 보조지표 시그널 스킬)
└── strategies/
    └── (향후 대순환 분석 등)
```

### Layer Responsibility

Skills files are **not** read by `domain/` — domain has no file I/O.
Reading and parsing skills `.md` files is the responsibility of **`infrastructure/skills/loader.ts`** (`FileSkillsLoader`).
The parsed `Skill[]` is passed into `domain/analysis/prompt.ts` as a plain data structure.

```
infrastructure/skills/loader.ts (FileSkillsLoader)
  → recursively scans skills/ subdirectories for .md files (file I/O — allowed in infrastructure layer)
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
