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

## 운영 기능

```
긴급 공지 팝업 — notices DB 테이블에 row를 직접 INSERT/UPDATE해 운영.
  - 노출 제어: is_active 토글, starts_at/ends_at 시간창, path_pattern 경로 타게팅
    (null=전역, /about 정확 일치, /symbol/* 접두 일치), priority(클수록 먼저)
  - 콘텐츠: title, body(마크다운), 선택 link_url/link_label(http(s)만 허용)
  - 클라이언트: 마운트 시 1회 fetch → 경로 매칭 + localStorage dismiss 필터 → 모달 표시
    "다시 보지 않기" = localStorage 영구 저장 / "닫기"/Esc/배경 = 임시(다음 방문 재노출)
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
Tests       Vitest + Testing Library + jsdom
```

External infrastructure dependencies:

```
Vercel      Next.js deployment and serverless/edge runtime
Upstash     Redis cache, analysis job state, email tokens
Neon        PostgreSQL database
Resend      Email verification and password reset delivery
Cloudflare  DNS, edge security, cache/traffic controls
```

Coverage target: 90% across all measured FSD layers (`entities/`, `features/`, `shared/`, `widgets/`, `app/`, and `src/proxy.ts`).

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

Skills files are loaded by the siglens app through the `entities/skill` slice.
The parsed `Skill[]` is passed to `@y0ngha/siglens-core` as plain data.
Core prompt builders consume the data structure only; file I/O stays in siglens.

```
entities/skill/api.ts
  → recursively scans skills/ subdirectories for .md files (file I/O — allowed in infrastructure layer)
  → parses frontmatter + body
  → returns Skill[]

entities/analysis/actions/*
  → loads Skill[] through the entity slice
  → passes Skill[] to @y0ngha/siglens-core submit functions

@y0ngha/siglens-core prompt builder
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
