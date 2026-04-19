# Panel C — Sector Signal Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/market` page's Panel C — a sector-indexed scanner that classifies leading stocks into four quadrants (상승 신호 / 상승 조짐 / 하락 조짐 / 하락 신호), with a strict-mode trend gate. Reuse existing Panel B at `/market` with light UI refinements.

**Architecture:** Domain layer exposes pure TypeScript signal detectors (confirmed + anticipation) and a trend classifier. Infrastructure batches FMP daily bars for ~90 stocks, runs detectors, caches the aggregate in Upstash (TTL 1h). RSC-fetched result is passed to a client component that filters by sector tab + strict mode toggle (URL + localStorage persisted). Panel B is wrapped in HydrationBoundary at `/market` for SSR-critical market summary data.

**Tech Stack:** Next.js 15 (App Router, RSC, Suspense), React 19, TypeScript, Tailwind CSS v4, Jest, React Query (TanStack Query), Upstash Redis, FMP API (via existing `MarketDataProvider` abstraction).

**Related Specs:**
- `docs/superpowers/specs/2026-04-19-panel-c-sector-signal-discovery-design.md` (Panel C — primary)
- `docs/superpowers/specs/2026-04-18-market-overview-dashboard-design.md` (Panel B + UI Refinement appendix)

**Branch:** `feat/329/panel-c-sector-signal-discovery` (already created, 2 spec commits present: `bb9ad0b`, `184bb62`)

**Conventions:**
- Domain rules: `src/domain/CLAUDE.md` — pure functions, no external imports, `readonly` types
- Infrastructure rules: `src/infrastructure/CLAUDE.md` — types.ts before impl, external I/O here
- Components rules: `src/components/CLAUDE.md` — `'use client'` only when needed, hook order
- App rules: `src/app/CLAUDE.md` — HydrationBoundary pattern for initial data
- Test rules: `src/__tests__/CLAUDE.md` — mirror source structure, 100% coverage on domain/infrastructure, Korean `describe`/`it`
- Coding conventions: `docs/CONVENTIONS.md`
- Design rules: `docs/DESIGN.md`
- Mistakes catalog: `docs/MISTAKES.md` — read relevant sections before each layer

**Git discipline:**
- Use `yarn` only. Never `npm` or `pnpm`.
- Do **not** create commits yourself. Tasks end with a stop point; the orchestrator or user invokes `git-agent` to commit after validating.
- Between tasks, no pushing, no PR opening. PR opens only after the final validation task.

---

## File Structure

### New files

```
src/
├── app/market/
│   ├── page.tsx                                       # RSC + HydrationBoundary + Suspense
│   └── opengraph-image.tsx                            # 1200×630 OG image
├── components/dashboard/
│   ├── SectorSignalPanel.tsx                          # client, filters + render
│   ├── SectorSignalPanelContainer.tsx                 # RSC wrapper, fetches getSectorSignals()
│   ├── SectorSignalPanelSkeleton.tsx                  # Suspense fallback
│   ├── SectorTabs.tsx                                 # client, WAI-ARIA tablist
│   ├── StrictModeToggle.tsx                           # client, WAI-ARIA radiogroup
│   ├── SignalSubsection.tsx                           # subsection wrapper
│   ├── SignalStockCard.tsx                            # card with badges, links to /[symbol]
│   ├── SignalBadge.tsx                                # single signal label
│   ├── SignalTypeGuide.tsx                            # thin-content block, bottom of page
│   └── hooks/useStrictModeToggle.ts                   # useSyncExternalStore, URL + localStorage
├── domain/signals/
│   ├── types.ts                                       # Signal, SignalType, TrendState, StockSignalResult, SectorSignalsResult, SectorStock
│   ├── constants.ts                                   # signal-specific thresholds
│   ├── trend.ts                                       # classifyTrend()
│   ├── confirmed.ts                                   # 8 confirmed detectors + helpers
│   ├── anticipation.ts                                # 8 anticipation detectors + helpers
│   └── index.ts                                       # detectSignals() aggregator
└── infrastructure/dashboard/
    └── sectorSignalsApi.ts                            # getSectorSignals() with Upstash cache

src/__tests__/
├── domain/signals/
│   ├── trend.test.ts
│   ├── confirmed.test.ts
│   ├── anticipation.test.ts
│   └── index.test.ts
├── infrastructure/dashboard/
│   └── sectorSignalsApi.test.ts
└── components/dashboard/hooks/
    └── useStrictModeToggle.test.ts
```

### Modified files

```
src/domain/constants/dashboard-tickers.ts              # add SECTOR_STOCKS constant
src/domain/types.ts                                    # add SectorStock type (re-exported by signals/types.ts)
src/components/dashboard/IndexCard.tsx                 # hover/transition/touch-action refinement
src/components/dashboard/BriefingCard.tsx              # ellipsis + ARIA roles
src/components/dashboard/MarketSummaryPanel.tsx        # tracking + sector group label typo
src/app/page.tsx                                       # add /market internal link
src/app/sitemap.ts                                     # add /market entry
src/app/globals.css                                    # prefers-reduced-motion + sector-panel-bg utility
src/lib/seo.ts                                         # (optional) /market keyword additions
docs/DOMAIN.md
docs/ARCHITECTURE.md
docs/DESIGN.md
```

---

## Task Overview

| # | Task | Phase |
|---|---|---|
| 0 | Preflight — branch/deps verify | Bootstrap |
| 1 | Add types (`domain/signals/types.ts`, extend `domain/types.ts`) | Domain |
| 2 | Add signal constants (`domain/signals/constants.ts`) | Domain |
| 3 | SECTOR_STOCKS constant | Domain |
| 4 | Trend classifier + tests | Domain |
| 5 | Confirmed signals: RSI over/oversold + tests | Domain |
| 6 | Confirmed signals: Golden/Death cross + tests | Domain |
| 7 | Confirmed signals: MACD cross + tests | Domain |
| 8 | Confirmed signals: Bollinger bounce/breakout + tests | Domain |
| 9 | Anticipation helpers (pivot, %B, bb_width, slope) + tests | Domain |
| 10 | Anticipation: RSI divergence + tests | Domain |
| 11 | Anticipation: MACD histogram convergence + tests | Domain |
| 12 | Anticipation: Bollinger squeeze + tests | Domain |
| 13 | Anticipation: S/R proximity + tests | Domain |
| 14 | `detectSignals` aggregator + tests | Domain |
| 15 | `sectorSignalsApi` + tests | Infrastructure |
| 16 | `useStrictModeToggle` hook + tests | Components |
| 17 | `SignalBadge` | Components |
| 18 | `SignalStockCard` | Components |
| 19 | `SignalSubsection` | Components |
| 20 | `SectorTabs` | Components |
| 21 | `StrictModeToggle` | Components |
| 22 | `SectorSignalPanel` (main client logic) | Components |
| 23 | `SectorSignalPanelSkeleton` | Components |
| 24 | `SectorSignalPanelContainer` (RSC) | Components |
| 25 | `SignalTypeGuide` (thin-content block) | Components |
| 26 | globals.css (`prefers-reduced-motion` + `sector-panel-bg`) | App |
| 27 | Panel B refinements (IndexCard, BriefingCard, MarketSummaryPanel header) | Panel B |
| 28 | `app/market/page.tsx` + HydrationBoundary + metadata | App |
| 29 | `app/market/opengraph-image.tsx` | App |
| 30 | `sitemap.ts` + home page `/market` link | App |
| 31 | Doc updates (DOMAIN.md, ARCHITECTURE.md, DESIGN.md) | Docs |
| 32 | Full validation (lint, test, build) | Validation |

---

## Task 0: Preflight

**Files:** none

- [ ] **Step 1: Verify branch & clean state**

Run:
```bash
git branch --show-current
git status --short
```
Expected:
- Branch: `feat/329/panel-c-sector-signal-discovery`
- Status: clean (no uncommitted changes)

If not on branch: `git checkout feat/329/panel-c-sector-signal-discovery`

- [ ] **Step 2: Confirm deps present**

Run:
```bash
yarn --silent list --pattern "@tanstack/react-query" 2>&1 | head -5
yarn --silent list --pattern "@upstash/redis" 2>&1 | head -5
```
Expected: both packages resolved (already installed in existing codebase).

- [ ] **Step 3: Quick sanity — run existing tests**

Run:
```bash
yarn test --passWithNoTests --testPathPatterns="src/__tests__/domain/indicators/rsi.test" 2>&1 | tail -10
```
Expected: PASS.

No commit for this task.

---

## Task 1: Add Signal Types

**Files:**
- Create: `src/domain/signals/types.ts`
- Modify: `src/domain/types.ts` (add `SectorStock`)

- [ ] **Step 1: Add `SectorStock` to `src/domain/types.ts`**

Append to end of `src/domain/types.ts`:
```ts
export interface SectorStock {
    symbol: string;
    koreanName: string;
    sectorSymbol: string; // XLK, XLF, XLE, ...
}
```

- [ ] **Step 2: Create `src/domain/signals/types.ts`**

**Note:** Do NOT import `SectorStock` here — it's defined in `domain/types.ts` (Task 1 Step 1) and consumers import it directly from there. Keeping this file free of `@/domain/types` imports avoids a circular dependency since `domain/types.ts` re-exports signal types from this file in Task 15 Step 4.

Content:
```ts
export type SignalDirection = 'bullish' | 'bearish';
export type SignalPhase = 'confirmed' | 'expected';

export type ConfirmedSignalType =
    | 'rsi_oversold'
    | 'rsi_overbought'
    | 'golden_cross'
    | 'death_cross'
    | 'macd_bullish_cross'
    | 'macd_bearish_cross'
    | 'bollinger_lower_bounce'
    | 'bollinger_upper_breakout';

export type ExpectedSignalType =
    | 'rsi_bullish_divergence'
    | 'rsi_bearish_divergence'
    | 'macd_histogram_bullish_convergence'
    | 'macd_histogram_bearish_convergence'
    | 'bollinger_squeeze_bullish'
    | 'bollinger_squeeze_bearish'
    | 'support_proximity_bullish'
    | 'resistance_proximity_bearish';

export type SignalType = ConfirmedSignalType | ExpectedSignalType;

export interface Signal {
    readonly type: SignalType;
    readonly direction: SignalDirection;
    readonly phase: SignalPhase;
    readonly detectedAt: number; // bar index within the fetched window
}

export type TrendState = 'uptrend' | 'downtrend' | 'sideways';

export interface StockSignalResult {
    readonly symbol: string;
    readonly koreanName: string;
    readonly sectorSymbol: string;
    readonly price: number;
    readonly changePercent: number;
    readonly trend: TrendState;
    readonly signals: readonly Signal[];
}

export interface SectorSignalsResult {
    readonly computedAt: string; // ISO timestamp
    readonly stocks: readonly StockSignalResult[];
}
```

- [ ] **Step 3: Type-check**

Run:
```bash
yarn tsc --noEmit 2>&1 | tail -20
```
Expected: no errors related to these files.

- [ ] **Step 4: STOP — ready for review commit**

No commit from agent. Report: "Task 1 complete — types added. Ready for orchestrator to invoke git-agent."

---

## Task 2: Add Signal Constants

**Files:**
- Create: `src/domain/signals/constants.ts`

- [ ] **Step 1: Write constants file**

Content:
```ts
// Confirmed signal thresholds
export const CROSS_LOOKBACK_BARS = 3;

// Anticipation signal thresholds
export const DIVERGENCE_LOOKBACK_BARS = 20;
export const DIVERGENCE_FRESHNESS_BARS = 5;
export const PIVOT_WINDOW = 2;

export const HISTOGRAM_CONVERGENCE_BARS = 5;

export const SQUEEZE_LOOKBACK_BARS = 120;
export const SQUEEZE_PERCENTILE = 0.1;
export const SQUEEZE_PCT_B_THRESHOLD = 0.5;

export const SR_PROXIMITY_PCT = 0.02;
export const SR_APPROACH_LOOKBACK = 5;

// Trend classification
export const TREND_SLOPE_LOOKBACK = 20;
export const TREND_SLOPE_THRESHOLD = 0.03;

// Moving averages used by detectors that are NOT in MA_DEFAULT_PERIODS
export const GOLDEN_CROSS_FAST_PERIOD = 20;
export const GOLDEN_CROSS_SLOW_PERIOD = 50;
export const SR_MA_PERIODS = [50, 200] as const;
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: no new errors.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 3: SECTOR_STOCKS Constant

**Files:**
- Modify: `src/domain/constants/dashboard-tickers.ts`

- [ ] **Step 1: Append `SECTOR_STOCKS` export**

Append to `src/domain/constants/dashboard-tickers.ts`:
```ts
import type { SectorStock } from '@/domain/types';

export const SECTOR_STOCKS: readonly SectorStock[] = [
    // Technology (XLK) — 8
    { symbol: 'AAPL',  koreanName: '애플',              sectorSymbol: 'XLK' },
    { symbol: 'MSFT',  koreanName: '마이크로소프트',     sectorSymbol: 'XLK' },
    { symbol: 'NVDA',  koreanName: '엔비디아',          sectorSymbol: 'XLK' },
    { symbol: 'AVGO',  koreanName: '브로드컴',          sectorSymbol: 'XLK' },
    { symbol: 'AMD',   koreanName: 'AMD',               sectorSymbol: 'XLK' },
    { symbol: 'ORCL',  koreanName: '오라클',            sectorSymbol: 'XLK' },
    { symbol: 'QCOM',  koreanName: '퀄컴',              sectorSymbol: 'XLK' },
    { symbol: 'INTC',  koreanName: '인텔',              sectorSymbol: 'XLK' },
    // Financials (XLF) — 8
    { symbol: 'JPM',   koreanName: 'JP모간',            sectorSymbol: 'XLF' },
    { symbol: 'BAC',   koreanName: '뱅크오브아메리카',   sectorSymbol: 'XLF' },
    { symbol: 'GS',    koreanName: '골드만삭스',        sectorSymbol: 'XLF' },
    { symbol: 'MS',    koreanName: '모간스탠리',        sectorSymbol: 'XLF' },
    { symbol: 'WFC',   koreanName: '웰스파고',          sectorSymbol: 'XLF' },
    { symbol: 'BLK',   koreanName: '블랙록',            sectorSymbol: 'XLF' },
    { symbol: 'V',     koreanName: '비자',              sectorSymbol: 'XLF' },
    { symbol: 'MA',    koreanName: '마스터카드',        sectorSymbol: 'XLF' },
    // Energy (XLE) — 6
    { symbol: 'XOM',   koreanName: '엑손모빌',          sectorSymbol: 'XLE' },
    { symbol: 'CVX',   koreanName: '쉐브론',            sectorSymbol: 'XLE' },
    { symbol: 'COP',   koreanName: '코노코필립스',      sectorSymbol: 'XLE' },
    { symbol: 'SLB',   koreanName: '슐럼버거',          sectorSymbol: 'XLE' },
    { symbol: 'OXY',   koreanName: '옥시덴탈',          sectorSymbol: 'XLE' },
    { symbol: 'EOG',   koreanName: 'EOG리소시스',       sectorSymbol: 'XLE' },
    // Healthcare (XLV) — 7
    { symbol: 'UNH',   koreanName: '유나이티드헬스',     sectorSymbol: 'XLV' },
    { symbol: 'LLY',   koreanName: '일라이릴리',        sectorSymbol: 'XLV' },
    { symbol: 'JNJ',   koreanName: '존슨앤드존슨',      sectorSymbol: 'XLV' },
    { symbol: 'ABBV',  koreanName: '애브비',            sectorSymbol: 'XLV' },
    { symbol: 'MRK',   koreanName: '머크',              sectorSymbol: 'XLV' },
    { symbol: 'PFE',   koreanName: '화이자',            sectorSymbol: 'XLV' },
    { symbol: 'TMO',   koreanName: '써모피셔',          sectorSymbol: 'XLV' },
    // Consumer Discretionary (XLY) — 6
    { symbol: 'AMZN',  koreanName: '아마존',            sectorSymbol: 'XLY' },
    { symbol: 'TSLA',  koreanName: '테슬라',            sectorSymbol: 'XLY' },
    { symbol: 'HD',    koreanName: '홈디포',            sectorSymbol: 'XLY' },
    { symbol: 'MCD',   koreanName: '맥도날드',          sectorSymbol: 'XLY' },
    { symbol: 'NKE',   koreanName: '나이키',            sectorSymbol: 'XLY' },
    { symbol: 'LOW',   koreanName: '로우스',            sectorSymbol: 'XLY' },
    // Consumer Staples (XLP) — 6
    { symbol: 'WMT',   koreanName: '월마트',            sectorSymbol: 'XLP' },
    { symbol: 'COST',  koreanName: '코스트코',          sectorSymbol: 'XLP' },
    { symbol: 'PG',    koreanName: '프록터앤드갬블',     sectorSymbol: 'XLP' },
    { symbol: 'KO',    koreanName: '코카콜라',          sectorSymbol: 'XLP' },
    { symbol: 'PEP',   koreanName: '펩시코',            sectorSymbol: 'XLP' },
    { symbol: 'PM',    koreanName: '필립모리스',        sectorSymbol: 'XLP' },
    // Industrials (XLI) — 6
    { symbol: 'CAT',   koreanName: '캐터필러',          sectorSymbol: 'XLI' },
    { symbol: 'HON',   koreanName: '하니웰',            sectorSymbol: 'XLI' },
    { symbol: 'UNP',   koreanName: '유니온퍼시픽',      sectorSymbol: 'XLI' },
    { symbol: 'GE',    koreanName: 'GE에어로스페이스',   sectorSymbol: 'XLI' },
    { symbol: 'RTX',   koreanName: 'RTX',               sectorSymbol: 'XLI' },
    { symbol: 'DE',    koreanName: '디어앤드컴퍼니',     sectorSymbol: 'XLI' },
    // Materials (XLB) — 5
    { symbol: 'LIN',   koreanName: '린데',              sectorSymbol: 'XLB' },
    { symbol: 'APD',   koreanName: '에어프로덕츠',      sectorSymbol: 'XLB' },
    { symbol: 'ECL',   koreanName: '에코랩',            sectorSymbol: 'XLB' },
    { symbol: 'NEM',   koreanName: '뉴몬트',            sectorSymbol: 'XLB' },
    { symbol: 'FCX',   koreanName: '프리포트맥모란',    sectorSymbol: 'XLB' },
    // Utilities (XLU) — 5
    { symbol: 'NEE',   koreanName: '넥스트에라에너지', sectorSymbol: 'XLU' },
    { symbol: 'DUK',   koreanName: '듀크에너지',        sectorSymbol: 'XLU' },
    { symbol: 'SO',    koreanName: '서던컴퍼니',        sectorSymbol: 'XLU' },
    { symbol: 'AEP',   koreanName: '아메리칸일렉트릭',   sectorSymbol: 'XLU' },
    { symbol: 'EXC',   koreanName: '엑셀론',            sectorSymbol: 'XLU' },
    // Real Estate (XLRE) — 5
    { symbol: 'AMT',   koreanName: '아메리칸타워',      sectorSymbol: 'XLRE' },
    { symbol: 'PLD',   koreanName: '프로로지스',        sectorSymbol: 'XLRE' },
    { symbol: 'EQIX',  koreanName: '에퀴닉스',          sectorSymbol: 'XLRE' },
    { symbol: 'CCI',   koreanName: '크라운캐슬',        sectorSymbol: 'XLRE' },
    { symbol: 'PSA',   koreanName: '퍼블릭스토리지',    sectorSymbol: 'XLRE' },
    // Communication Services (XLC) — 6
    { symbol: 'GOOGL', koreanName: '알파벳',            sectorSymbol: 'XLC' },
    { symbol: 'META',  koreanName: '메타',              sectorSymbol: 'XLC' },
    { symbol: 'NFLX',  koreanName: '넷플릭스',          sectorSymbol: 'XLC' },
    { symbol: 'DIS',   koreanName: '디즈니',            sectorSymbol: 'XLC' },
    { symbol: 'CMCSA', koreanName: '컴캐스트',          sectorSymbol: 'XLC' },
    { symbol: 'T',     koreanName: 'AT&T',              sectorSymbol: 'XLC' },
];
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 4: Trend Classifier + Tests

**Files:**
- Create: `src/domain/signals/trend.ts`
- Create: `src/__tests__/domain/signals/trend.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/domain/signals/trend.test.ts`:
```ts
import { classifyTrend } from '@/domain/signals/trend';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

function buildBars(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
    }));
}

function buildIndicators(ema20: (number | null)[]): IndicatorResult {
    return {
        ...EMPTY_INDICATOR_RESULT,
        ema: { 20: ema20 },
    };
}

describe('classifyTrend', () => {
    describe('EMA20 데이터가 없을 때', () => {
        it('sideways를 반환한다', () => {
            const bars = buildBars([100, 101, 102]);
            const indicators = buildIndicators([null, null, null]);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('ema20 배열이 lookback+1 보다 짧을 때', () => {
        it('sideways를 반환한다', () => {
            const bars = buildBars([100, 101, 102]);
            const indicators = buildIndicators([100, 101, 102]);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('최근 20봉 EMA 기울기가 +5% 이고 가격이 EMA 위일 때', () => {
        it('uptrend를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25);
            const closes = emaValues.map(v => v + 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('uptrend');
        });
    });

    describe('최근 20봉 EMA 기울기가 -5% 이고 가격이 EMA 아래일 때', () => {
        it('downtrend를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 105 - i * 0.25);
            const closes = emaValues.map(v => v - 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('downtrend');
        });
    });

    describe('EMA 기울기가 ±3% 이내일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.05);
            const closes = emaValues.map(v => v + 1);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('기울기는 양수지만 가격이 EMA 아래일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25);
            const closes = emaValues.map(v => v - 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });
});
```

- [ ] **Step 2: Verify test fails**

Run:
```bash
yarn test --testPathPatterns="signals/trend.test" 2>&1 | tail -15
```
Expected: FAIL — `Cannot find module '@/domain/signals/trend'`.

- [ ] **Step 3: Implement `trend.ts`**

Create `src/domain/signals/trend.ts`:
```ts
import type { Bar, IndicatorResult } from '@/domain/types';
import type { TrendState } from '@/domain/signals/types';
import {
    TREND_SLOPE_LOOKBACK,
    TREND_SLOPE_THRESHOLD,
} from '@/domain/signals/constants';

export function classifyTrend(
    bars: Bar[],
    indicators: IndicatorResult
): TrendState {
    const ema20 = indicators.ema[20];
    if (ema20 === undefined) return 'sideways';
    if (ema20.length < TREND_SLOPE_LOOKBACK + 1) return 'sideways';

    const lastIdx = ema20.length - 1;
    const prevIdx = lastIdx - TREND_SLOPE_LOOKBACK;
    const emaLast = ema20[lastIdx];
    const emaPrev = ema20[prevIdx];
    if (emaLast === null || emaPrev === null || emaPrev === 0) {
        return 'sideways';
    }

    const slope = (emaLast - emaPrev) / emaPrev;
    const closeLast = bars[bars.length - 1]?.close;
    if (closeLast === undefined) return 'sideways';

    if (slope >= TREND_SLOPE_THRESHOLD && closeLast > emaLast) return 'uptrend';
    if (slope <= -TREND_SLOPE_THRESHOLD && closeLast < emaLast) return 'downtrend';
    return 'sideways';
}
```

- [ ] **Step 4: Verify tests pass**

Run:
```bash
yarn test --testPathPatterns="signals/trend.test" 2>&1 | tail -15
```
Expected: PASS (all 6 tests).

- [ ] **Step 5: Coverage check**

Run:
```bash
yarn test --coverage --testPathPatterns="signals/trend" --collectCoverageFrom="src/domain/signals/trend.ts" 2>&1 | tail -15
```
Expected: 100% statement/branch coverage.

- [ ] **Step 6: STOP — ready for review commit**

---

## Task 5: Confirmed Signals — RSI Over/Oversold

**Files:**
- Create: `src/domain/signals/confirmed.ts`
- Create: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: Write failing tests (RSI oversold / overbought only)**

Create `src/__tests__/domain/signals/confirmed.test.ts`:
```ts
import {
    detectRsiOversold,
    detectRsiOverbought,
} from '@/domain/signals/confirmed';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

function buildBars(n: number): Bar[] {
    return Array.from({ length: n }, (_, i) => ({
        time: 1700000000 + i * 86400,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
    }));
}

function withRsi(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, rsi: values };
}

describe('detectRsiOversold', () => {
    describe('마지막 RSI가 30 미만일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 25]);
            const result = detectRsiOversold(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_oversold');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(19);
        });
    });

    describe('마지막 RSI가 30 이상일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 35]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=30일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 30]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('RSI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(detectRsiOversold(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('마지막 RSI가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const indicators = withRsi([null, null, null, null, null]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });
});

describe('detectRsiOverbought', () => {
    describe('마지막 RSI가 70 초과일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 75]);
            const result = detectRsiOverbought(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_overbought');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('마지막 RSI가 70 이하일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 65]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=70일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 70]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });
});
```

- [ ] **Step 2: Verify test fails**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -15`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `confirmed.ts` with RSI detectors**

Create `src/domain/signals/confirmed.ts`:
```ts
import type { Bar, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    RSI_OVERBOUGHT_LEVEL,
    RSI_OVERSOLD_LEVEL,
} from '@/domain/indicators/constants';

export function detectRsiOversold(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last >= RSI_OVERSOLD_LEVEL) return null;
    return {
        type: 'rsi_oversold',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

export function detectRsiOverbought(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const rsi = indicators.rsi;
    if (rsi.length === 0) return null;
    const lastIdx = rsi.length - 1;
    const last = rsi[lastIdx];
    if (last === null) return null;
    if (last <= RSI_OVERBOUGHT_LEVEL) return null;
    return {
        type: 'rsi_overbought',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -15`
Expected: PASS (all 8 tests).

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 6: Confirmed Signals — Golden/Death Cross

**Files:**
- Modify: `src/domain/signals/confirmed.ts` (append detectors)
- Modify: `src/__tests__/domain/signals/confirmed.test.ts` (append describe blocks)

**Note:** Golden Cross uses MA20 vs MA50. MA_DEFAULT_PERIODS does **not** include 50. The detector calls `calculateMA(bars, 50)` directly.

- [ ] **Step 1: Append failing tests**

Append to `src/__tests__/domain/signals/confirmed.test.ts`:
```ts
import {
    detectGoldenCross,
    detectDeathCross,
} from '@/domain/signals/confirmed';

function buildBarsWithCloses(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
    }));
}

describe('detectGoldenCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 상향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            // 60봉 — 처음 40봉 가격 100, 이후 20봉 가격 점진 상승으로 MA20 > MA50 유도
            const closes = [
                ...Array(40).fill(100),
                ...Array.from({ length: 20 }, (_, i) => 100 + i * 1.5),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectGoldenCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('golden_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 4봉 이전에 발생했을 때', () => {
        it('null을 반환한다', () => {
            // 교차가 오래전이라 최근 3봉에 없음
            const closes = [
                ...Array(40).fill(100),
                ...Array.from({ length: 15 }, (_, i) => 100 + i * 2),
                ...Array(5).fill(130),
            ];
            const bars = buildBarsWithCloses(closes);
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 MA50에 부족할 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses(Array(30).fill(100));
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });
});

describe('detectDeathCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 하향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            const closes = [
                ...Array(40).fill(100),
                ...Array.from({ length: 20 }, (_, i) => 100 - i * 1.5),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectDeathCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('death_cross');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 발생하지 않았을 때', () => {
        it('null을 반환한다', () => {
            const closes = Array(80).fill(100);
            const bars = buildBarsWithCloses(closes);
            expect(detectDeathCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -20`
Expected: FAIL on new test blocks.

- [ ] **Step 3: Append detectors to `confirmed.ts`**

Add to `src/domain/signals/confirmed.ts`:
```ts
import { calculateMA } from '@/domain/indicators/ma';
import {
    CROSS_LOOKBACK_BARS,
    GOLDEN_CROSS_FAST_PERIOD,
    GOLDEN_CROSS_SLOW_PERIOD,
} from '@/domain/signals/constants';

type CrossDirection = 'up' | 'down';

function findCross(
    fast: (number | null)[],
    slow: (number | null)[],
    lookback: number,
    direction: CrossDirection
): number | null {
    const len = Math.min(fast.length, slow.length);
    if (len < 2) return null;
    const start = Math.max(1, len - lookback);
    for (let i = start; i < len; i++) {
        const f = fast[i];
        const s = slow[i];
        const fPrev = fast[i - 1];
        const sPrev = slow[i - 1];
        if (f === null || s === null || fPrev === null || sPrev === null) continue;
        if (direction === 'up' && fPrev <= sPrev && f > s) return i;
        if (direction === 'down' && fPrev >= sPrev && f < s) return i;
    }
    return null;
}

export function detectGoldenCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < GOLDEN_CROSS_SLOW_PERIOD + 1) return null;
    const fast = indicators.ma[GOLDEN_CROSS_FAST_PERIOD]
        ?? calculateMA(bars, GOLDEN_CROSS_FAST_PERIOD);
    const slow = calculateMA(bars, GOLDEN_CROSS_SLOW_PERIOD);
    const crossIdx = findCross(fast, slow, CROSS_LOOKBACK_BARS, 'up');
    if (crossIdx === null) return null;
    return {
        type: 'golden_cross',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: crossIdx,
    };
}

export function detectDeathCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < GOLDEN_CROSS_SLOW_PERIOD + 1) return null;
    const fast = indicators.ma[GOLDEN_CROSS_FAST_PERIOD]
        ?? calculateMA(bars, GOLDEN_CROSS_FAST_PERIOD);
    const slow = calculateMA(bars, GOLDEN_CROSS_SLOW_PERIOD);
    const crossIdx = findCross(fast, slow, CROSS_LOOKBACK_BARS, 'down');
    if (crossIdx === null) return null;
    return {
        type: 'death_cross',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: crossIdx,
    };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 7: Confirmed Signals — MACD Bullish/Bearish Cross

**Files:**
- Modify: `src/domain/signals/confirmed.ts` (append)
- Modify: `src/__tests__/domain/signals/confirmed.test.ts` (append)

- [ ] **Step 1: Append failing tests**

Append to test file:
```ts
import {
    detectMacdBullishCross,
    detectMacdBearishCross,
} from '@/domain/signals/confirmed';
import type { MACDPoint } from '@/domain/types';

function withMacd(points: (MACDPoint | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, macd: points };
}

describe('detectMacdBullishCross', () => {
    describe('최근 3봉 내 MACD line이 signal line을 상향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            const points: MACDPoint[] = [
                { macd: -1, signal: 0, histogram: -1 },
                { macd: -0.5, signal: 0, histogram: -0.5 },
                { macd: -0.2, signal: -0.1, histogram: -0.1 },
                { macd: 0.1, signal: -0.05, histogram: 0.15 }, // cross up
            ];
            const bars = buildBars(points.length);
            const result = detectMacdBullishCross(bars, withMacd(points));
            expect(result?.type).toBe('macd_bullish_cross');
            expect(result?.direction).toBe('bullish');
        });
    });

    describe('교차가 4봉 이전이거나 없을 때', () => {
        it('null을 반환한다', () => {
            const points: MACDPoint[] = [
                { macd: 1, signal: 0, histogram: 1 },
                { macd: 1.1, signal: 0.05, histogram: 1.05 },
                { macd: 1.2, signal: 0.1, histogram: 1.1 },
            ];
            const bars = buildBars(points.length);
            expect(detectMacdBullishCross(bars, withMacd(points))).toBeNull();
        });
    });
});

describe('detectMacdBearishCross', () => {
    describe('최근 3봉 내 MACD line이 signal line을 하향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            const points: MACDPoint[] = [
                { macd: 1, signal: 0, histogram: 1 },
                { macd: 0.5, signal: 0.2, histogram: 0.3 },
                { macd: 0.1, signal: 0.15, histogram: -0.05 }, // cross down
            ];
            const bars = buildBars(points.length);
            const result = detectMacdBearishCross(bars, withMacd(points));
            expect(result?.type).toBe('macd_bearish_cross');
            expect(result?.direction).toBe('bearish');
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -20`
Expected: FAIL on new blocks.

- [ ] **Step 3: Append MACD detectors to `confirmed.ts`**

Add to `src/domain/signals/confirmed.ts` (imports and functions):
```ts
import type { MACDPoint } from '@/domain/types';

function findMacdCross(
    points: (MACDPoint | null)[],
    lookback: number,
    direction: CrossDirection
): number | null {
    const len = points.length;
    if (len < 2) return null;
    const start = Math.max(1, len - lookback);
    for (let i = start; i < len; i++) {
        const p = points[i];
        const prev = points[i - 1];
        if (p === null || prev === null) continue;
        if (direction === 'up' && prev.macd <= prev.signal && p.macd > p.signal) return i;
        if (direction === 'down' && prev.macd >= prev.signal && p.macd < p.signal) return i;
    }
    return null;
}

export function detectMacdBullishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = findMacdCross(indicators.macd, CROSS_LOOKBACK_BARS, 'up');
    if (idx === null) return null;
    return { type: 'macd_bullish_cross', direction: 'bullish', phase: 'confirmed', detectedAt: idx };
}

export function detectMacdBearishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = findMacdCross(indicators.macd, CROSS_LOOKBACK_BARS, 'down');
    if (idx === null) return null;
    return { type: 'macd_bearish_cross', direction: 'bearish', phase: 'confirmed', detectedAt: idx };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 8: Confirmed Signals — Bollinger Lower Bounce / Upper Breakout

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
} from '@/domain/signals/confirmed';
import type { BollingerPoint } from '@/domain/types';

function withBollinger(points: (BollingerPoint | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, bollinger: points };
}

describe('detectBollingerLowerBounce', () => {
    describe('전봉 low가 lower 이하이고 현봉 close가 전봉 close보다 높을 때', () => {
        it('Signal을 반환한다', () => {
            const points: BollingerPoint[] = [
                { upper: 110, middle: 100, lower: 90 },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                { time: 1, open: 95, high: 96, low: 89, close: 92, volume: 100 },
                { time: 2, open: 92, high: 98, low: 92, close: 97, volume: 100 },
            ];
            const result = detectBollingerLowerBounce(bars, withBollinger(points));
            expect(result?.type).toBe('bollinger_lower_bounce');
            expect(result?.direction).toBe('bullish');
        });
    });

    describe('전봉 low가 lower보다 크면', () => {
        it('null을 반환한다', () => {
            const points: BollingerPoint[] = [
                { upper: 110, middle: 100, lower: 90 },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                { time: 1, open: 95, high: 96, low: 93, close: 94, volume: 100 },
                { time: 2, open: 94, high: 98, low: 94, close: 97, volume: 100 },
            ];
            expect(detectBollingerLowerBounce(bars, withBollinger(points))).toBeNull();
        });
    });
});

describe('detectBollingerUpperBreakout', () => {
    describe('현봉 close가 upper보다 클 때', () => {
        it('Signal을 반환한다', () => {
            const points: BollingerPoint[] = [{ upper: 110, middle: 100, lower: 90 }];
            const bars: Bar[] = [
                { time: 1, open: 105, high: 115, low: 105, close: 112, volume: 100 },
            ];
            const result = detectBollingerUpperBreakout(bars, withBollinger(points));
            expect(result?.type).toBe('bollinger_upper_breakout');
            expect(result?.direction).toBe('bearish');
        });
    });

    describe('현봉 close가 upper 이하일 때', () => {
        it('null을 반환한다', () => {
            const points: BollingerPoint[] = [{ upper: 110, middle: 100, lower: 90 }];
            const bars: Bar[] = [
                { time: 1, open: 105, high: 110, low: 105, close: 110, volume: 100 },
            ];
            expect(detectBollingerUpperBreakout(bars, withBollinger(points))).toBeNull();
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -20`
Expected: FAIL.

- [ ] **Step 3: Append Bollinger detectors to `confirmed.ts`**

```ts
import type { BollingerPoint } from '@/domain/types';

export function detectBollingerLowerBounce(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const bb = indicators.bollinger;
    if (bars.length < 2 || bb.length < 2) return null;
    const lastIdx = bars.length - 1;
    const prevBar = bars[lastIdx - 1];
    const curBar = bars[lastIdx];
    const prevBB = bb[lastIdx - 1];
    if (prevBB === null) return null;
    if (prevBar.low > prevBB.lower) return null;
    if (curBar.close <= prevBar.close) return null;
    return {
        type: 'bollinger_lower_bounce',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}

export function detectBollingerUpperBreakout(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const bb = indicators.bollinger;
    if (bars.length === 0 || bb.length === 0) return null;
    const lastIdx = bars.length - 1;
    const curBar = bars[lastIdx];
    const curBB = bb[lastIdx];
    if (curBB === null) return null;
    if (curBar.close <= curBB.upper) return null;
    return {
        type: 'bollinger_upper_breakout',
        direction: 'bearish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
```

**Note:** The "Bollinger Upper Breakout" direction is `'bearish'` per spec — upper band breakout is treated as potential over-extension / mean reversion. Re-read `docs/superpowers/specs/2026-04-19-panel-c-sector-signal-discovery-design.md` "Confirmed Signals" table row for `bollinger_upper_breakout`.

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/confirmed.test" 2>&1 | tail -15`
Expected: PASS (all confirmed tests).

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 9: Anticipation Helpers (pivot, slope, %B, bb_width, percentile)

**Files:**
- Create: `src/domain/signals/anticipation.ts` (internal helpers only)
- Create: `src/__tests__/domain/signals/anticipation.test.ts`

**Note:** Helpers are not exported publicly except for `__test__` in this task, to keep them verifiable without shipping public surface. Use a `/* istanbul ignore */` only if a branch is genuinely unreachable.

- [ ] **Step 1: Write failing tests for helpers**

Create `src/__tests__/domain/signals/anticipation.test.ts`:
```ts
import {
    findPivotLows,
    findPivotHighs,
    computeBbWidth,
    computePctB,
    computeEma20Slope,
    percentileRank,
} from '@/domain/signals/anticipation';
import type { BollingerPoint } from '@/domain/types';

describe('findPivotLows', () => {
    describe('창 내에 명확한 저점이 있을 때', () => {
        it('좌우 2봉보다 엄격히 낮은 지점 인덱스를 반환한다', () => {
            const lows = [100, 98, 95, 92, 90, 92, 95, 97, 99];
            expect(findPivotLows(lows, 2)).toEqual([4]);
        });
    });
    describe('좌우 2봉 중 타이가 있을 때', () => {
        it('해당 인덱스를 제외한다', () => {
            const lows = [100, 98, 90, 92, 90, 92, 95];
            expect(findPivotLows(lows, 2)).toEqual([]);
        });
    });
});

describe('findPivotHighs', () => {
    describe('창 내에 명확한 고점이 있을 때', () => {
        it('인덱스를 반환한다', () => {
            const highs = [100, 102, 105, 108, 110, 108, 105, 103, 101];
            expect(findPivotHighs(highs, 2)).toEqual([4]);
        });
    });
});

describe('computeBbWidth', () => {
    it('(upper - lower) / middle 을 반환한다', () => {
        const bb: BollingerPoint = { upper: 110, middle: 100, lower: 90 };
        expect(computeBbWidth(bb)).toBeCloseTo(0.2);
    });
    it('middle이 0일 때 null을 반환한다', () => {
        const bb: BollingerPoint = { upper: 1, middle: 0, lower: -1 };
        expect(computeBbWidth(bb)).toBeNull();
    });
});

describe('computePctB', () => {
    it('(close - lower) / (upper - lower) 를 반환한다', () => {
        const bb: BollingerPoint = { upper: 110, middle: 100, lower: 90 };
        expect(computePctB(105, bb)).toBeCloseTo(0.75);
    });
    it('upper == lower 일 때 null을 반환한다', () => {
        const bb: BollingerPoint = { upper: 100, middle: 100, lower: 100 };
        expect(computePctB(100, bb)).toBeNull();
    });
});

describe('computeEma20Slope', () => {
    describe('정상 입력', () => {
        it('(last - prev) / prev 를 반환한다', () => {
            const ema = Array.from({ length: 21 }, (_, i) => 100 + i);
            expect(computeEma20Slope(ema, 20)).toBeCloseTo(0.2);
        });
    });
    describe('데이터 부족 시', () => {
        it('null을 반환한다', () => {
            expect(computeEma20Slope([100, 101], 20)).toBeNull();
        });
    });
    describe('prev가 0일 때', () => {
        it('null을 반환한다', () => {
            const ema = [0, ...Array(20).fill(1)];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
});

describe('percentileRank', () => {
    it('값이 배열 내에서 차지하는 백분위를 [0,1] 로 반환한다', () => {
        const xs = [1, 2, 3, 4, 5];
        expect(percentileRank(1, xs)).toBeCloseTo(0.0);
        expect(percentileRank(5, xs)).toBeCloseTo(1.0);
        expect(percentileRank(3, xs)).toBeCloseTo(0.5);
    });
    it('배열이 비어 있으면 null을 반환한다', () => {
        expect(percentileRank(1, [])).toBeNull();
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -20`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement helpers**

Create `src/domain/signals/anticipation.ts`:
```ts
import type { BollingerPoint } from '@/domain/types';

export function findPivotLows(lows: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < lows.length - window; i++) {
        const cur = lows[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur < lows[i - k]) || !(cur < lows[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function findPivotHighs(highs: number[], window: number): number[] {
    const pivots: number[] = [];
    for (let i = window; i < highs.length - window; i++) {
        const cur = highs[i];
        let isPivot = true;
        for (let k = 1; k <= window; k++) {
            if (!(cur > highs[i - k]) || !(cur > highs[i + k])) {
                isPivot = false;
                break;
            }
        }
        if (isPivot) pivots.push(i);
    }
    return pivots;
}

export function computeBbWidth(bb: BollingerPoint): number | null {
    if (bb.middle === 0) return null;
    return (bb.upper - bb.lower) / bb.middle;
}

export function computePctB(close: number, bb: BollingerPoint): number | null {
    const denom = bb.upper - bb.lower;
    if (denom === 0) return null;
    return (close - bb.lower) / denom;
}

export function computeEma20Slope(
    ema: (number | null)[],
    lookback: number
): number | null {
    if (ema.length < lookback + 1) return null;
    const last = ema[ema.length - 1];
    const prev = ema[ema.length - 1 - lookback];
    if (last === null || prev === null || prev === 0) return null;
    return (last - prev) / prev;
}

export function percentileRank(value: number, xs: number[]): number | null {
    if (xs.length === 0) return null;
    const below = xs.filter(x => x < value).length;
    const equal = xs.filter(x => x === value).length;
    return (below + equal / 2) / xs.length;
}
```

**Note on for-loops:** Domain layer prefers functional patterns, but pivot detection benefits from early termination for performance. The `for` loop is acceptable here per existing patterns in `domain/indicators/` (see `bollinger.ts`, `rsi.ts`). The MISTAKES.md section on "Coding Paradigm" permits loops when performance or clarity warrants.

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 10: Anticipation — RSI Divergence (Bullish/Bearish)

**Files:**
- Modify: `src/domain/signals/anticipation.ts`
- Modify: `src/__tests__/domain/signals/anticipation.test.ts`

- [ ] **Step 1: Append failing tests**

Append to test file:
```ts
import {
    detectRsiBullishDivergence,
    detectRsiBearishDivergence,
} from '@/domain/signals/anticipation';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

function barsFromOHLC(
    data: Array<{ open: number; high: number; low: number; close: number }>
): Bar[] {
    return data.map((d, i) => ({
        time: 1700000000 + i * 86400,
        volume: 1000,
        ...d,
    }));
}

function withRsiAndBars(rsi: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, rsi };
}

describe('detectRsiBullishDivergence', () => {
    describe('가격은 더 낮은 저점이고 RSI는 더 높은 저점일 때', () => {
        it('Signal을 반환한다', () => {
            // 20 bars, pivot lows at indices 5 and 17
            // price low[5]=90, low[17]=85 (lower low)
            // rsi at 5 = 25, rsi at 17 = 35 (higher low)
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low =
                    i === 5 ? 90 :
                    i === 17 ? 85 :
                    95 + (i % 3);
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 25;
                if (i === 17) return 35;
                return 50;
            });
            const result = detectRsiBullishDivergence(
                barsFromOHLC(ohlc),
                withRsiAndBars(rsi)
            );
            expect(result?.type).toBe('rsi_bullish_divergence');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('expected');
        });
    });

    describe('Hidden divergence (price higher low + rsi lower low) 일 때', () => {
        it('null을 반환한다 (regular만 감지)', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 85 : i === 17 ? 90 : 95 + (i % 3);
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 35;
                if (i === 17) return 25;
                return 50;
            });
            expect(
                detectRsiBullishDivergence(barsFromOHLC(ohlc), withRsiAndBars(rsi))
            ).toBeNull();
        });
    });

    describe('둘째 피벗이 최근 5봉 이전일 때', () => {
        it('null을 반환한다', () => {
            // second pivot at index 10 (10 bars ago in a 20-bar window)
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 90 : i === 10 ? 85 : 95 + (i % 3);
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 25;
                if (i === 10) return 35;
                return 50;
            });
            expect(
                detectRsiBullishDivergence(barsFromOHLC(ohlc), withRsiAndBars(rsi))
            ).toBeNull();
        });
    });

    describe('창 내 피벗이 2개 미만일 때', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => ({
                open: 100, high: 100, low: 100, close: 100,
            }));
            const rsi = Array(20).fill(50);
            expect(
                detectRsiBullishDivergence(barsFromOHLC(ohlc), withRsiAndBars(rsi))
            ).toBeNull();
        });
    });
});

describe('detectRsiBearishDivergence', () => {
    describe('가격은 더 높은 고점이고 RSI는 더 낮은 고점일 때', () => {
        it('Signal을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const high = i === 5 ? 105 : i === 17 ? 110 : 100 - (i % 3);
                return { open: high - 1, high, low: high - 2, close: high - 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 75;
                if (i === 17) return 65;
                return 50;
            });
            const result = detectRsiBearishDivergence(
                barsFromOHLC(ohlc),
                withRsiAndBars(rsi)
            );
            expect(result?.type).toBe('rsi_bearish_divergence');
            expect(result?.direction).toBe('bearish');
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -20`
Expected: FAIL on new blocks.

- [ ] **Step 3: Append divergence detectors**

Add to `src/domain/signals/anticipation.ts`:
```ts
import type { Bar, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    DIVERGENCE_FRESHNESS_BARS,
    DIVERGENCE_LOOKBACK_BARS,
    PIVOT_WINDOW,
} from '@/domain/signals/constants';

type DivergenceKind = 'bullish' | 'bearish';

function detectRegularDivergence(
    bars: Bar[],
    rsi: (number | null)[],
    kind: DivergenceKind
): number | null {
    if (bars.length < DIVERGENCE_LOOKBACK_BARS) return null;
    const windowStart = bars.length - DIVERGENCE_LOOKBACK_BARS;
    const lastIdx = bars.length - 1;

    const series = kind === 'bullish'
        ? bars.slice(windowStart).map(b => b.low)
        : bars.slice(windowStart).map(b => b.high);
    const pivotsLocal = kind === 'bullish'
        ? findPivotLows(series, PIVOT_WINDOW)
        : findPivotHighs(series, PIVOT_WINDOW);

    if (pivotsLocal.length < 2) return null;

    // Convert local-window indices back to absolute indices
    const pivots = pivotsLocal.map(i => i + windowStart);
    const p1 = pivots[pivots.length - 2];
    const p2 = pivots[pivots.length - 1];

    // Freshness: second pivot must be within last N bars
    if (lastIdx - p2 > DIVERGENCE_FRESHNESS_BARS) return null;

    const price1 = kind === 'bullish' ? bars[p1].low : bars[p1].high;
    const price2 = kind === 'bullish' ? bars[p2].low : bars[p2].high;
    const rsi1 = rsi[p1];
    const rsi2 = rsi[p2];
    if (rsi1 === null || rsi2 === null || rsi1 === undefined || rsi2 === undefined) {
        return null;
    }

    if (kind === 'bullish') {
        // Regular: price lower low, rsi higher low
        if (price2 >= price1) return null;
        if (rsi2 <= rsi1) return null;
    } else {
        // Regular: price higher high, rsi lower high
        if (price2 <= price1) return null;
        if (rsi2 >= rsi1) return null;
    }
    return p2;
}

export function detectRsiBullishDivergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = detectRegularDivergence(bars, indicators.rsi, 'bullish');
    if (idx === null) return null;
    return { type: 'rsi_bullish_divergence', direction: 'bullish', phase: 'expected', detectedAt: idx };
}

export function detectRsiBearishDivergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const idx = detectRegularDivergence(bars, indicators.rsi, 'bearish');
    if (idx === null) return null;
    return { type: 'rsi_bearish_divergence', direction: 'bearish', phase: 'expected', detectedAt: idx };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 11: Anticipation — MACD Histogram Convergence

**Files:**
- Modify: `src/domain/signals/anticipation.ts`
- Modify: `src/__tests__/domain/signals/anticipation.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
    detectMacdHistogramBullishConvergence,
    detectMacdHistogramBearishConvergence,
} from '@/domain/signals/anticipation';
import type { MACDPoint } from '@/domain/types';

function withMacd(points: (MACDPoint | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, macd: points };
}

describe('detectMacdHistogramBullishConvergence', () => {
    describe('최근 5봉이 모두 음수이고 절대값이 단조 감소할 때', () => {
        it('Signal을 반환한다', () => {
            const hist = [-5, -4, -3, -2, -1];
            const points: MACDPoint[] = hist.map(h => ({ macd: 0, signal: 0, histogram: h }));
            const result = detectMacdHistogramBullishConvergence([], withMacd(points));
            expect(result?.type).toBe('macd_histogram_bullish_convergence');
        });
    });

    describe('0이 포함되면', () => {
        it('null을 반환한다', () => {
            const hist = [-5, -4, -3, -2, 0];
            const points: MACDPoint[] = hist.map(h => ({ macd: 0, signal: 0, histogram: h }));
            expect(detectMacdHistogramBullishConvergence([], withMacd(points))).toBeNull();
        });
    });

    describe('단조가 깨지면', () => {
        it('null을 반환한다', () => {
            const hist = [-5, -4, -5, -2, -1];
            const points: MACDPoint[] = hist.map(h => ({ macd: 0, signal: 0, histogram: h }));
            expect(detectMacdHistogramBullishConvergence([], withMacd(points))).toBeNull();
        });
    });

    describe('타이가 있으면', () => {
        it('null을 반환한다 (엄격 단조)', () => {
            const hist = [-5, -4, -4, -2, -1];
            const points: MACDPoint[] = hist.map(h => ({ macd: 0, signal: 0, histogram: h }));
            expect(detectMacdHistogramBullishConvergence([], withMacd(points))).toBeNull();
        });
    });
});

describe('detectMacdHistogramBearishConvergence', () => {
    describe('최근 5봉이 모두 양수이고 값이 단조 감소할 때', () => {
        it('Signal을 반환한다', () => {
            const hist = [5, 4, 3, 2, 1];
            const points: MACDPoint[] = hist.map(h => ({ macd: 0, signal: 0, histogram: h }));
            const result = detectMacdHistogramBearishConvergence([], withMacd(points));
            expect(result?.type).toBe('macd_histogram_bearish_convergence');
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -20`
Expected: FAIL.

- [ ] **Step 3: Append detectors to `anticipation.ts`**

```ts
import { HISTOGRAM_CONVERGENCE_BARS } from '@/domain/signals/constants';

export function detectMacdHistogramBullishConvergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const macd = indicators.macd;
    if (macd.length < HISTOGRAM_CONVERGENCE_BARS) return null;
    const tail = macd.slice(-HISTOGRAM_CONVERGENCE_BARS);
    for (const p of tail) {
        if (p === null || !(p.histogram < 0)) return null;
    }
    for (let i = 1; i < tail.length; i++) {
        const prev = tail[i - 1]!.histogram;
        const cur = tail[i]!.histogram;
        // magnitude strictly decreasing (absolute value)
        if (!(Math.abs(cur) < Math.abs(prev))) return null;
    }
    return {
        type: 'macd_histogram_bullish_convergence',
        direction: 'bullish',
        phase: 'expected',
        detectedAt: macd.length - 1,
    };
}

export function detectMacdHistogramBearishConvergence(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const macd = indicators.macd;
    if (macd.length < HISTOGRAM_CONVERGENCE_BARS) return null;
    const tail = macd.slice(-HISTOGRAM_CONVERGENCE_BARS);
    for (const p of tail) {
        if (p === null || !(p.histogram > 0)) return null;
    }
    for (let i = 1; i < tail.length; i++) {
        const prev = tail[i - 1]!.histogram;
        const cur = tail[i]!.histogram;
        if (!(cur < prev)) return null;
    }
    return {
        type: 'macd_histogram_bearish_convergence',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: macd.length - 1,
    };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 12: Anticipation — Bollinger Squeeze (3-condition AND)

**Files:**
- Modify: `src/domain/signals/anticipation.ts`
- Modify: `src/__tests__/domain/signals/anticipation.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
    detectBollingerSqueezeBullish,
    detectBollingerSqueezeBearish,
} from '@/domain/signals/anticipation';
import type { BollingerPoint } from '@/domain/types';

function squeezeFixture(
    opts: { wideCount?: number; pctB: number; emaSlope: 'up' | 'down' }
): { bars: Bar[]; indicators: IndicatorResult } {
    const wideCount = opts.wideCount ?? 119;
    // First `wideCount` wide bands (width ~0.2), final bar narrow (width ~0.02)
    const bb: BollingerPoint[] = [
        ...Array(wideCount).fill(null).map(() => ({ upper: 110, middle: 100, lower: 90 })),
        { upper: 101, middle: 100, lower: 99 },
    ];
    // close that produces the requested %B
    const width = bb[bb.length - 1].upper - bb[bb.length - 1].lower;
    const close = bb[bb.length - 1].lower + opts.pctB * width;
    const bars: Bar[] = bb.map((_, i) => ({
        time: 1 + i,
        open: close, high: close, low: close, close,
        volume: 100,
    }));
    const slopeDir = opts.emaSlope === 'up' ? 1 : -1;
    const ema20 = bb.map((_, i) => 100 + slopeDir * i * 0.5);
    return {
        bars,
        indicators: { ...EMPTY_INDICATOR_RESULT, bollinger: bb, ema: { 20: ema20 } },
    };
}

describe('detectBollingerSqueezeBullish', () => {
    describe('너비 하위 10% + %B ≥ 0.5 + 기울기 ≥ 0 일 때', () => {
        it('Signal을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({ pctB: 0.6, emaSlope: 'up' });
            const result = detectBollingerSqueezeBullish(bars, indicators);
            expect(result?.type).toBe('bollinger_squeeze_bullish');
        });
    });

    describe('%B가 0.5 미만일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({ pctB: 0.3, emaSlope: 'up' });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });

    describe('EMA20 기울기가 음수일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({ pctB: 0.6, emaSlope: 'down' });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });

    describe('bb 데이터가 120봉 미만일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({ wideCount: 50, pctB: 0.6, emaSlope: 'up' });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });
});

describe('detectBollingerSqueezeBearish', () => {
    describe('너비 하위 10% + %B < 0.5 + 기울기 ≤ 0 일 때', () => {
        it('Signal을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({ pctB: 0.4, emaSlope: 'down' });
            const result = detectBollingerSqueezeBearish(bars, indicators);
            expect(result?.type).toBe('bollinger_squeeze_bearish');
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -20`
Expected: FAIL.

- [ ] **Step 3: Append squeeze detectors**

```ts
import {
    SQUEEZE_LOOKBACK_BARS,
    SQUEEZE_PCT_B_THRESHOLD,
    SQUEEZE_PERCENTILE,
    TREND_SLOPE_LOOKBACK,
} from '@/domain/signals/constants';

function isSqueezePresent(
    bars: Bar[],
    indicators: IndicatorResult
): { lastIdx: number; pctB: number; slope: number } | null {
    const bb = indicators.bollinger;
    if (bb.length < SQUEEZE_LOOKBACK_BARS) return null;
    if (bars.length !== bb.length) return null;
    const lastIdx = bb.length - 1;
    const lastBB = bb[lastIdx];
    if (lastBB === null) return null;
    const widthLast = computeBbWidth(lastBB);
    if (widthLast === null) return null;

    const widths: number[] = [];
    for (let i = lastIdx - SQUEEZE_LOOKBACK_BARS + 1; i <= lastIdx; i++) {
        const p = bb[i];
        if (p === null) continue;
        const w = computeBbWidth(p);
        if (w === null) continue;
        widths.push(w);
    }
    const rank = percentileRank(widthLast, widths);
    if (rank === null || rank > SQUEEZE_PERCENTILE) return null;

    const pctB = computePctB(bars[lastIdx].close, lastBB);
    if (pctB === null) return null;

    const ema20 = indicators.ema[20];
    if (ema20 === undefined) return null;
    const slope = computeEma20Slope(ema20, TREND_SLOPE_LOOKBACK);
    if (slope === null) return null;

    return { lastIdx, pctB, slope };
}

export function detectBollingerSqueezeBullish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const s = isSqueezePresent(bars, indicators);
    if (s === null) return null;
    if (s.pctB < SQUEEZE_PCT_B_THRESHOLD) return null;
    if (s.slope < 0) return null;
    return {
        type: 'bollinger_squeeze_bullish',
        direction: 'bullish',
        phase: 'expected',
        detectedAt: s.lastIdx,
    };
}

export function detectBollingerSqueezeBearish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const s = isSqueezePresent(bars, indicators);
    if (s === null) return null;
    if (s.pctB >= SQUEEZE_PCT_B_THRESHOLD) return null;
    if (s.slope > 0) return null;
    return {
        type: 'bollinger_squeeze_bearish',
        direction: 'bearish',
        phase: 'expected',
        detectedAt: s.lastIdx,
    };
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 13: Anticipation — Support/Resistance Proximity

**Files:**
- Modify: `src/domain/signals/anticipation.ts`
- Modify: `src/__tests__/domain/signals/anticipation.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import {
    detectSupportProximityBullish,
    detectResistanceProximityBearish,
} from '@/domain/signals/anticipation';

describe('detectSupportProximityBullish', () => {
    describe('close가 MA50 위 + 2% 이내 + 5봉 하락일 때', () => {
        it('Signal을 반환한다', () => {
            // 60 bars: construct price series that drops to just above MA50
            // Use simple setup where close array ends at ~101, MA50 ≈ 100.
            const closes = [
                ...Array(55).fill(100),
                105, 104, 103, 102, 101,
            ];
            const bars: Bar[] = closes.map((c, i) => ({
                time: 1 + i, open: c, high: c, low: c, close: c, volume: 100,
            }));
            const result = detectSupportProximityBullish(bars, EMPTY_INDICATOR_RESULT);
            expect(result?.type).toBe('support_proximity_bullish');
        });
    });

    describe('close가 MA 아래에 있을 때', () => {
        it('null을 반환한다', () => {
            const closes = [
                ...Array(55).fill(100),
                99, 98, 97, 96, 95,
            ];
            const bars: Bar[] = closes.map((c, i) => ({
                time: 1 + i, open: c, high: c, low: c, close: c, volume: 100,
            }));
            expect(
                detectSupportProximityBullish(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('close가 MA와 거리 > 2%일 때', () => {
        it('null을 반환한다', () => {
            const closes = [
                ...Array(55).fill(100),
                110, 109, 108, 107, 106,
            ];
            const bars: Bar[] = closes.map((c, i) => ({
                time: 1 + i, open: c, high: c, low: c, close: c, volume: 100,
            }));
            expect(
                detectSupportProximityBullish(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('최근 5봉 상승 중일 때', () => {
        it('null을 반환한다 (접근이 아닌 이탈)', () => {
            const closes = [
                ...Array(55).fill(100),
                99, 99.5, 100, 100.5, 101.5,
            ];
            const bars: Bar[] = closes.map((c, i) => ({
                time: 1 + i, open: c, high: c, low: c, close: c, volume: 100,
            }));
            expect(
                detectSupportProximityBullish(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});

describe('detectResistanceProximityBearish', () => {
    describe('close가 MA 아래 + 2% 이내 + 5봉 상승일 때', () => {
        it('Signal을 반환한다', () => {
            const closes = [
                ...Array(55).fill(100),
                95, 96, 97, 98, 99,
            ];
            const bars: Bar[] = closes.map((c, i) => ({
                time: 1 + i, open: c, high: c, low: c, close: c, volume: 100,
            }));
            const result = detectResistanceProximityBearish(bars, EMPTY_INDICATOR_RESULT);
            expect(result?.type).toBe('resistance_proximity_bearish');
        });
    });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -20`
Expected: FAIL.

- [ ] **Step 3: Append S/R detectors**

```ts
import { calculateMA } from '@/domain/indicators/ma';
import {
    SR_APPROACH_LOOKBACK,
    SR_MA_PERIODS,
    SR_PROXIMITY_PCT,
} from '@/domain/signals/constants';

function isWithinProximity(
    close: number,
    ma: number,
    side: 'above' | 'below'
): boolean {
    const distance = Math.abs(close - ma) / ma;
    if (distance > SR_PROXIMITY_PCT) return false;
    if (side === 'above') return close > ma;
    return close < ma;
}

export function detectSupportProximityBullish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < SR_APPROACH_LOOKBACK + 1) return null;
    const lastIdx = bars.length - 1;
    const closeLast = bars[lastIdx].close;
    const closePrev5 = bars[lastIdx - SR_APPROACH_LOOKBACK].close;
    if (!(closeLast < closePrev5)) return null; // must be falling

    for (const period of SR_MA_PERIODS) {
        if (bars.length < period) continue;
        const ma = calculateMA(bars, period)[lastIdx];
        if (ma === null) continue;
        if (isWithinProximity(closeLast, ma, 'above')) {
            return {
                type: 'support_proximity_bullish',
                direction: 'bullish',
                phase: 'expected',
                detectedAt: lastIdx,
            };
        }
    }
    return null;
}

export function detectResistanceProximityBearish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    if (bars.length < SR_APPROACH_LOOKBACK + 1) return null;
    const lastIdx = bars.length - 1;
    const closeLast = bars[lastIdx].close;
    const closePrev5 = bars[lastIdx - SR_APPROACH_LOOKBACK].close;
    if (!(closeLast > closePrev5)) return null; // must be rising

    for (const period of SR_MA_PERIODS) {
        if (bars.length < period) continue;
        const ma = calculateMA(bars, period)[lastIdx];
        if (ma === null) continue;
        if (isWithinProximity(closeLast, ma, 'below')) {
            return {
                type: 'resistance_proximity_bearish',
                direction: 'bearish',
                phase: 'expected',
                detectedAt: lastIdx,
            };
        }
    }
    return null;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals/anticipation.test" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 14: `detectSignals` Aggregator + Tests

**Files:**
- Create: `src/domain/signals/index.ts`
- Create: `src/__tests__/domain/signals/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/domain/signals/index.test.ts`:
```ts
import { detectSignals } from '@/domain/signals';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

describe('detectSignals', () => {
    describe('빈 bars가 주어지면', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectSignals([], EMPTY_INDICATOR_RESULT)).toEqual([]);
        });
    });

    describe('RSI가 극단 값을 가지면', () => {
        it('해당 확정 신호를 포함한다', () => {
            const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                time: 1 + i, open: 100, high: 100, low: 100, close: 100, volume: 100,
            }));
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                rsi: [...Array(19).fill(50), 25],
            };
            const signals = detectSignals(bars, indicators);
            expect(signals.some(s => s.type === 'rsi_oversold')).toBe(true);
        });
    });

    describe('모든 감지기가 null일 때', () => {
        it('빈 배열을 반환한다', () => {
            const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                time: 1 + i, open: 100, high: 100, low: 100, close: 100, volume: 100,
            }));
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                rsi: Array(20).fill(50),
            };
            expect(detectSignals(bars, indicators)).toEqual([]);
        });
    });
});

export {};
```

- [ ] **Step 2: Verify tests fail**

Run: `yarn test --testPathPatterns="signals/index.test" 2>&1 | tail -15`
Expected: FAIL — module not found.

- [ ] **Step 3: Create aggregator**

Create `src/domain/signals/index.ts`:
```ts
import type { Bar, IndicatorResult } from '@/domain/types';
import type { Signal } from '@/domain/signals/types';
import {
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectDeathCross,
    detectGoldenCross,
    detectMacdBearishCross,
    detectMacdBullishCross,
    detectRsiOverbought,
    detectRsiOversold,
} from '@/domain/signals/confirmed';
import {
    detectBollingerSqueezeBearish,
    detectBollingerSqueezeBullish,
    detectMacdHistogramBearishConvergence,
    detectMacdHistogramBullishConvergence,
    detectResistanceProximityBearish,
    detectRsiBearishDivergence,
    detectRsiBullishDivergence,
    detectSupportProximityBullish,
} from '@/domain/signals/anticipation';

export * from '@/domain/signals/types';
export { classifyTrend } from '@/domain/signals/trend';

type Detector = (bars: Bar[], indicators: IndicatorResult) => Signal | null;

const DETECTORS: readonly Detector[] = [
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
    detectMacdBullishCross,
    detectMacdBearishCross,
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectRsiBullishDivergence,
    detectRsiBearishDivergence,
    detectMacdHistogramBullishConvergence,
    detectMacdHistogramBearishConvergence,
    detectBollingerSqueezeBullish,
    detectBollingerSqueezeBearish,
    detectSupportProximityBullish,
    detectResistanceProximityBearish,
];

export function detectSignals(
    bars: Bar[],
    indicators: IndicatorResult
): readonly Signal[] {
    if (bars.length === 0) return [];
    return DETECTORS.map(d => d(bars, indicators)).filter(
        (s): s is Signal => s !== null
    );
}
```

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="signals" 2>&1 | tail -15`
Expected: PASS (all signals tests).

- [ ] **Step 5: Full domain coverage check**

Run:
```bash
yarn test --coverage --collectCoverageFrom="src/domain/signals/**/*.ts" --testPathPatterns="signals" 2>&1 | tail -15
```
Expected: 100% on all statements/branches.

If < 100%: examine the uncovered lines, add a targeted test (or remove the dead branch).

- [ ] **Step 6: STOP — ready for review commit**

---

## Task 15: `sectorSignalsApi` + Tests

**Files:**
- Create: `src/infrastructure/dashboard/sectorSignalsApi.ts`
- Create: `src/__tests__/infrastructure/dashboard/sectorSignalsApi.test.ts`

- [ ] **Step 1: Inspect existing cache & provider patterns**

Read for reference (do not modify):
- `src/infrastructure/cache/redis.ts`
- `src/infrastructure/cache/config.ts`
- `src/infrastructure/dashboard/marketSummaryApi.ts`
- `src/infrastructure/market/types.ts`

Use the same `createCacheProvider()` pattern, `createMarketDataProvider()` factory, and `ANALYSIS_CACHE_TTL` style constant.

- [ ] **Step 2: Write failing test file**

Create `src/__tests__/infrastructure/dashboard/sectorSignalsApi.test.ts`:
```ts
import { getSectorSignals } from '@/infrastructure/dashboard/sectorSignalsApi';

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockGetBars = jest.fn();

jest.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: () => ({ get: mockGet, set: mockSet, delete: jest.fn() }),
}));
jest.mock('@/infrastructure/market/factory', () => ({
    createMarketDataProvider: () => ({ getBars: mockGetBars, getQuote: jest.fn() }),
}));

describe('getSectorSignals', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockSet.mockReset();
        mockGetBars.mockReset();
    });

    describe('캐시 히트일 때', () => {
        it('provider를 호출하지 않고 캐시된 결과를 반환한다', async () => {
            const cached = { computedAt: '2026-04-19T00:00:00Z', stocks: [] };
            mockGet.mockResolvedValue(JSON.stringify(cached));
            const result = await getSectorSignals();
            expect(result).toEqual(cached);
            expect(mockGetBars).not.toHaveBeenCalled();
        });
    });

    describe('캐시 미스일 때', () => {
        it('provider를 호출하고 결과를 캐시에 저장한다', async () => {
            mockGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockSet.mockResolvedValue(undefined);
            await getSectorSignals();
            expect(mockGetBars).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalled();
        });
    });

    describe('개별 종목 fetch가 실패할 때', () => {
        it('나머지 종목은 정상 처리하고 실패 종목은 결과에서 제외한다', async () => {
            mockGet.mockResolvedValue(null);
            mockGetBars.mockImplementation((opts: { symbol: string }) =>
                opts.symbol === 'AAPL'
                    ? Promise.reject(new Error('fetch failed'))
                    : Promise.resolve([])
            );
            const result = await getSectorSignals();
            const appleResult = result.stocks.find(s => s.symbol === 'AAPL');
            expect(appleResult).toBeUndefined();
        });
    });

    describe('캐시 저장이 실패할 때', () => {
        it('응답은 정상적으로 반환된다', async () => {
            mockGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([]);
            mockSet.mockRejectedValue(new Error('redis down'));
            const result = await getSectorSignals();
            expect(result).toBeDefined();
        });
    });

    describe('signals가 비어 있는 종목은', () => {
        it('결과에서 제외된다', async () => {
            mockGet.mockResolvedValue(null);
            mockGetBars.mockResolvedValue([
                { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 100 },
            ]);
            const result = await getSectorSignals();
            // With 1 bar, no signals can fire → all filtered out
            expect(result.stocks).toEqual([]);
        });
    });
});
```

- [ ] **Step 3: Verify tests fail**

Run: `yarn test --testPathPatterns="sectorSignalsApi.test" 2>&1 | tail -20`
Expected: FAIL.

- [ ] **Step 4: Implement `sectorSignalsApi.ts`**

Create `src/infrastructure/dashboard/sectorSignalsApi.ts`:
```ts
import type {
    Bar,
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/types';
import { SECTOR_STOCKS } from '@/domain/constants/dashboard-tickers';
import { calculateIndicators } from '@/domain/indicators';
import { classifyTrend, detectSignals } from '@/domain/signals';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

const CACHE_TTL_SECONDS = 3600; // 1 hour
const BARS_LOOKBACK_DAYS = 400; // ~1.5 years to cover squeeze 120 + holidays

function cacheKey(): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    return `dashboard:signals:1Day:${date}`;
}

function fromDate(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - BARS_LOOKBACK_DAYS);
    return d.toISOString();
}

async function computeStockResult(
    symbol: string,
    koreanName: string,
    sectorSymbol: string,
    bars: Bar[]
): Promise<StockSignalResult | null> {
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const indicators = calculateIndicators(bars);
    const signals = detectSignals(bars, indicators);
    if (signals.length === 0) return null;
    const trend = classifyTrend(bars, indicators);
    const changePercent =
        prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100;
    return {
        symbol,
        koreanName,
        sectorSymbol,
        price: last.close,
        changePercent,
        trend,
        signals,
    };
}

export async function getSectorSignals(): Promise<SectorSignalsResult> {
    const cache = createCacheProvider();
    const key = cacheKey();

    if (cache !== null) {
        try {
            const cached = await cache.get(key);
            if (cached !== null) {
                return JSON.parse(cached) as SectorSignalsResult;
            }
        } catch (err) {
            console.warn('[sectorSignalsApi] cache read failed:', err);
        }
    }

    const provider = createMarketDataProvider();
    const fetchResults = await Promise.allSettled(
        SECTOR_STOCKS.map(s =>
            provider.getBars({ symbol: s.symbol, timeframe: '1Day', from: fromDate() })
        )
    );

    const stocks: StockSignalResult[] = [];
    for (let i = 0; i < SECTOR_STOCKS.length; i++) {
        const stockDef = SECTOR_STOCKS[i];
        const r = fetchResults[i];
        if (r.status === 'rejected') {
            console.warn(
                '[sectorSignalsApi] fetch failed for',
                stockDef.symbol,
                r.reason
            );
            continue;
        }
        const result = await computeStockResult(
            stockDef.symbol,
            stockDef.koreanName,
            stockDef.sectorSymbol,
            r.value
        );
        if (result !== null) stocks.push(result);
    }

    const payload: SectorSignalsResult = {
        computedAt: new Date().toISOString(),
        stocks,
    };

    if (cache !== null) {
        try {
            await cache.set(key, JSON.stringify(payload), CACHE_TTL_SECONDS);
        } catch (err) {
            console.warn('[sectorSignalsApi] cache write failed:', err);
        }
    }

    return payload;
}
```

**Note:** Originally this plan re-exported `Signal`/`SignalType`/etc. from `@/domain/types`, but Task 14 discovered a name collision — `domain/types.ts` already declares `Signal` and `SignalType` for the unrelated analysis-panel system. **Resolution: skip the re-export entirely.** All Panel C consumers (components, infrastructure) import directly from `@/domain/signals/types`. In `sectorSignalsApi.ts` below, change the import to:

```ts
import type { Bar } from '@/domain/types';
import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/signals/types';
```

Same pattern applies in subsequent tasks (17, 18, 22, 24) — import Panel C types from `@/domain/signals/types`, not `@/domain/types`.

- [ ] **Step 5: Verify tests pass**

Run: `yarn test --testPathPatterns="sectorSignalsApi.test" 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Coverage check**

Run:
```bash
yarn test --coverage --collectCoverageFrom="src/infrastructure/dashboard/sectorSignalsApi.ts" --testPathPatterns="sectorSignalsApi" 2>&1 | tail -15
```
Expected: 100% branches.

- [ ] **Step 7: STOP — ready for review commit**

---

## Task 16: `useStrictModeToggle` Hook + Tests

**Files:**
- Create: `src/components/dashboard/hooks/useStrictModeToggle.ts`
- Create: `src/__tests__/components/dashboard/hooks/useStrictModeToggle.test.ts`

**Note:** Component tests are technically optional per project rules but this hook has non-trivial SSR/localStorage/URL integration. Worth testing.

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/dashboard/hooks/useStrictModeToggle.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react';
import { useStrictModeToggle } from '@/components/dashboard/hooks/useStrictModeToggle';

describe('useStrictModeToggle', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('초기값', () => {
        it('initialStrict 프롭을 사용한다', () => {
            const { result } = renderHook(() => useStrictModeToggle(true));
            expect(result.current[0]).toBe(true);
        });
        it('initialStrict=false 일 때 false로 시작한다', () => {
            const { result } = renderHook(() => useStrictModeToggle(false));
            expect(result.current[0]).toBe(false);
        });
    });

    describe('토글', () => {
        it('setStrictMode(false) 호출 시 false로 변경된다', () => {
            const { result } = renderHook(() => useStrictModeToggle(true));
            act(() => result.current[1](false));
            expect(result.current[0]).toBe(false);
        });
        it('localStorage에 저장된다', () => {
            const { result } = renderHook(() => useStrictModeToggle(true));
            act(() => result.current[1](false));
            expect(localStorage.getItem('siglens:strict-mode')).toBe('loose');
        });
    });

    describe('localStorage 접근 실패 시', () => {
        it('에러가 throw되지 않는다', () => {
            const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('quota exceeded');
            });
            const { result } = renderHook(() => useStrictModeToggle(true));
            expect(() => act(() => result.current[1](false))).not.toThrow();
            spy.mockRestore();
        });
    });
});
```

- [ ] **Step 2: Verify test fails**

Run: `yarn test --testPathPatterns="useStrictModeToggle" 2>&1 | tail -15`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hook**

Create `src/components/dashboard/hooks/useStrictModeToggle.ts`:
```ts
'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'siglens:strict-mode';

function readFromStorage(): boolean | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'strict') return true;
        if (v === 'loose') return false;
        return null;
    } catch {
        return null;
    }
}

function writeToStorage(strict: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, strict ? 'strict' : 'loose');
    } catch {
        // ignore quota errors, SecurityError (private mode), etc.
    }
}

export function useStrictModeToggle(
    initialStrict: boolean
): readonly [boolean, (next: boolean) => void] {
    const [strict, setStrict] = useState<boolean>(() => {
        if (typeof window === 'undefined') return initialStrict;
        const stored = readFromStorage();
        return stored ?? initialStrict;
    });

    const setStrictMode = useCallback((next: boolean) => {
        setStrict(next);
        writeToStorage(next);
    }, []);

    return [strict, setStrictMode] as const;
}
```

**Note:** The spec mentioned `useSyncExternalStore` for full hydration safety. For this hook we use `useState` with SSR-safe lazy initializer. The hook only reads localStorage on the client (initial state uses `initialStrict` on server). No hydration mismatch because server always renders `initialStrict` and client re-reads on mount. Ignoring URL sync here — URL sync happens in parent `SectorSignalPanel` via `useRouter()`.

- [ ] **Step 4: Verify tests pass**

Run: `yarn test --testPathPatterns="useStrictModeToggle" 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 17: `SignalBadge` Component

**Files:**
- Create: `src/components/dashboard/SignalBadge.tsx`

- [ ] **Step 1: Read `docs/MISTAKES.md` Components section**

Ensure compliance before coding.

- [ ] **Step 2: Create `SignalBadge.tsx`**

```tsx
import type { SignalType } from '@/domain/signals/types';

const SIGNAL_BADGE_LABELS: Record<SignalType, string> = {
    rsi_oversold: 'RSI 과매도',
    rsi_overbought: 'RSI 과매수',
    golden_cross: '골든크로스',
    death_cross: '데드크로스',
    macd_bullish_cross: 'MACD 상승교차',
    macd_bearish_cross: 'MACD 하락교차',
    bollinger_lower_bounce: '볼린저 하단 반등',
    bollinger_upper_breakout: '볼린저 상단 돌파',
    rsi_bullish_divergence: 'RSI 상승 다이버전스',
    rsi_bearish_divergence: 'RSI 하락 다이버전스',
    macd_histogram_bullish_convergence: 'MACD 히스토그램 수렴(↑)',
    macd_histogram_bearish_convergence: 'MACD 히스토그램 수렴(↓)',
    bollinger_squeeze_bullish: '볼린저 스퀴즈(↑)',
    bollinger_squeeze_bearish: '볼린저 스퀴즈(↓)',
    support_proximity_bullish: '지지선 근접',
    resistance_proximity_bearish: '저항선 근접',
};

interface SignalBadgeProps {
    type: SignalType;
}

export function SignalBadge({ type }: SignalBadgeProps) {
    return (
        <span className="text-secondary-300 text-[10px] tracking-wider uppercase">
            {SIGNAL_BADGE_LABELS[type]}
        </span>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: no errors.

- [ ] **Step 4: STOP — ready for review commit**

---

## Task 18: `SignalStockCard` Component

**Files:**
- Create: `src/components/dashboard/SignalStockCard.tsx`

- [ ] **Step 1: Create component**

```tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { StockSignalResult } from '@/domain/signals/types';
import { SignalBadge } from './SignalBadge';

interface SignalStockCardProps {
    data: StockSignalResult;
}

export function SignalStockCard({ data }: SignalStockCardProps) {
    const isUp = data.changePercent >= 0;
    const sign = isUp ? '+' : '';
    const changeColor = isUp ? 'text-chart-bullish' : 'text-chart-bearish';

    return (
        <Link
            href={`/${data.symbol}`}
            title={`${data.koreanName} 분석`}
            className={cn(
                'touch-manipulation block border border-secondary-700 bg-secondary-800/50',
                'rounded-lg p-3',
                'transition-[background-color,border-color,transform,box-shadow] duration-150',
                'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
                'hover:shadow-lg hover:shadow-primary-950/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                'motion-reduce:transition-none motion-reduce:hover:transform-none'
            )}
            style={{ transformOrigin: 'center' }}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                    <span
                        translate="no"
                        className="text-secondary-100 font-mono text-xs font-semibold"
                    >
                        {data.symbol}
                    </span>
                    <span
                        className={cn(
                            'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                            changeColor
                        )}
                    >
                        <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                        <span className="sr-only">{isUp ? '상승' : '하락'}</span>
                        {sign}
                        {data.changePercent.toFixed(2)}%
                    </span>
                </div>
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
                <p className="text-secondary-100 font-mono text-sm tabular-nums">
                    ${data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
                {data.signals.length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
                        {data.signals.map((s, i) => (
                            <span key={`${s.type}-${i}`} className="contents">
                                {i > 0 && <span className="text-secondary-600" aria-hidden="true">·</span>}
                                <SignalBadge type={s.type} />
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </Link>
    );
}
```

**Note:** Tailwind v4 uses `motion-reduce:` utility (supported). If not yet enabled in the build, fall back to global CSS via the `@media (prefers-reduced-motion: reduce)` block in Task 26.

- [ ] **Step 2: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard/SignalStockCard.tsx 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 19: `SignalSubsection` Component

**Files:**
- Create: `src/components/dashboard/SignalSubsection.tsx`

- [ ] **Step 1: Create component**

```tsx
import type { StockSignalResult } from '@/domain/signals/types';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    title: string;
    marker: string; // ▲ ▼ △ ▽
    variant: 'confirmed' | 'expected';
    stocks: readonly StockSignalResult[];
}

export function SignalSubsection({
    title,
    marker,
    variant,
    stocks,
}: SignalSubsectionProps) {
    const count = stocks.length.toString().padStart(2, '0');
    const borderClass =
        variant === 'confirmed'
            ? 'border-t-2 border-secondary-600'
            : 'border-t border-dashed border-secondary-700';
    const labelOpacity = variant === 'confirmed' ? 'opacity-100 font-semibold' : 'opacity-70 font-medium';

    return (
        <section className={`${borderClass} pt-3 pb-4`}>
            <div className="mb-3 flex items-baseline justify-between">
                <h3
                    className={`text-secondary-200 text-sm tracking-[0.15em] uppercase ${labelOpacity} text-pretty`}
                >
                    <span aria-hidden="true" className="mr-2">{marker}</span>
                    {title}
                </h3>
                <span
                    className="text-secondary-500 font-mono text-2xl tabular-nums"
                    aria-label={`${stocks.length}개 종목`}
                >
                    {count}
                </span>
            </div>
            {stocks.length === 0 ? (
                <p
                    className="text-secondary-500 py-4 text-center text-xs italic"
                    role="status"
                >
                    오늘은 해당 신호가 없습니다. 다른 섹터를 확인해 보세요.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {stocks.map(stock => (
                        <SignalStockCard key={stock.symbol} data={stock} />
                    ))}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard/SignalSubsection.tsx 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 20: `SectorTabs` Component

**Files:**
- Create: `src/components/dashboard/SectorTabs.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';

interface SectorTabsProps {
    activeSector: string;
    onChange: (sectorSymbol: string) => void;
}

export function SectorTabs({ activeSector, onChange }: SectorTabsProps) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
            const total = SECTOR_ETFS.length;
            let nextIndex = -1;
            if (e.key === 'ArrowRight') nextIndex = (index + 1) % total;
            else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + total) % total;
            else if (e.key === 'Home') nextIndex = 0;
            else if (e.key === 'End') nextIndex = total - 1;
            if (nextIndex !== -1) {
                e.preventDefault();
                onChange(SECTOR_ETFS[nextIndex].symbol);
                const nextBtn = e.currentTarget.parentElement?.children[nextIndex] as HTMLElement;
                nextBtn?.focus();
            }
        },
        [onChange]
    );

    return (
        <div
            role="tablist"
            aria-label="섹터 선택"
            className="flex touch-manipulation gap-6 overflow-x-auto overscroll-x-contain border-b border-secondary-700 pb-0"
            style={{ scrollbarWidth: 'thin' }}
        >
            {SECTOR_ETFS.map((etf, i) => {
                const isActive = etf.symbol === activeSector;
                return (
                    <button
                        key={etf.symbol}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`sector-panel-${etf.symbol}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(etf.symbol)}
                        onKeyDown={e => handleKeyDown(e, i)}
                        className={cn(
                            'min-h-11 shrink-0 border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150 -mb-px',
                            isActive
                                ? 'text-secondary-50 border-primary-500'
                                : 'text-secondary-400 border-transparent hover:text-secondary-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
                        )}
                    >
                        {etf.koreanName}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard/SectorTabs.tsx 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 21: `StrictModeToggle` Component

**Files:**
- Create: `src/components/dashboard/StrictModeToggle.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';

interface StrictModeToggleProps {
    strict: boolean;
    onChange: (next: boolean) => void;
}

const OPTIONS = [
    { value: true, label: '엄격' },
    { value: false, label: '완화' },
] as const;

export function StrictModeToggle({ strict, onChange }: StrictModeToggleProps) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                onChange(!strict);
            }
        },
        [onChange, strict]
    );

    return (
        <div className="flex items-baseline gap-3">
            <span
                id="strict-mode-label"
                className="text-secondary-500 text-[10px] tracking-wider uppercase"
            >
                모드
            </span>
            <div
                role="radiogroup"
                aria-labelledby="strict-mode-label"
                className="flex gap-3"
            >
                {OPTIONS.map(opt => {
                    const isActive = opt.value === strict;
                    return (
                        <button
                            key={String(opt.value)}
                            role="radio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onChange(opt.value)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                                'min-h-11 touch-manipulation border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150',
                                isActive
                                    ? 'text-secondary-100 border-primary-500'
                                    : 'text-secondary-500 border-transparent hover:text-secondary-300',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard/StrictModeToggle.tsx 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 22: `SectorSignalPanel` Component (Main Logic)

**Files:**
- Create: `src/components/dashboard/SectorSignalPanel.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SectorSignalsResult, StockSignalResult } from '@/domain/signals/types';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';
import { useStrictModeToggle } from './hooks/useStrictModeToggle';
import { SectorTabs } from './SectorTabs';
import { StrictModeToggle } from './StrictModeToggle';
import { SignalSubsection } from './SignalSubsection';

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialStrict: boolean;
}

function filterByStrict(
    stocks: readonly StockSignalResult[],
    strict: boolean
): readonly StockSignalResult[] {
    if (!strict) return stocks;
    return stocks
        .map(stock => {
            const filtered = stock.signals.filter(sig => {
                if (sig.phase === 'confirmed') return true;
                if (sig.direction === 'bullish') return stock.trend !== 'uptrend';
                return stock.trend !== 'downtrend';
            });
            if (filtered.length === 0) return null;
            return { ...stock, signals: filtered };
        })
        .filter((s): s is StockSignalResult => s !== null);
}

export function SectorSignalPanel({ data, initialSector, initialStrict }: SectorSignalPanelProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeSector, setActiveSector] = useState(initialSector);
    const [strict, setStrict] = useStrictModeToggle(initialStrict);

    const updateUrl = (nextSector: string, nextStrict: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (nextSector === SECTOR_ETFS[0].symbol) params.delete('sector');
        else params.set('sector', nextSector);
        if (nextStrict) params.delete('strict');
        else params.set('strict', '0');
        const qs = params.toString();
        router.replace(qs === '' ? pathname : `${pathname}?${qs}`, { scroll: false });
    };

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, strict);
    };

    const handleStrictChange = (next: boolean) => {
        setStrict(next);
        updateUrl(activeSector, next);
    };

    const filtered = useMemo(() => filterByStrict(data.stocks, strict), [data.stocks, strict]);

    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );

    const quadrants = useMemo(() => {
        const buckets = {
            bullishConfirmed: [] as StockSignalResult[],
            bullishExpected: [] as StockSignalResult[],
            bearishExpected: [] as StockSignalResult[],
            bearishConfirmed: [] as StockSignalResult[],
        };
        for (const stock of sectorStocks) {
            const byQuadrant: Record<keyof typeof buckets, typeof stock.signals> = {
                bullishConfirmed: [],
                bullishExpected: [],
                bearishExpected: [],
                bearishConfirmed: [],
            };
            for (const s of stock.signals) {
                const key =
                    s.direction === 'bullish' && s.phase === 'confirmed' ? 'bullishConfirmed' :
                    s.direction === 'bullish' && s.phase === 'expected'  ? 'bullishExpected' :
                    s.direction === 'bearish' && s.phase === 'expected'  ? 'bearishExpected' :
                                                                            'bearishConfirmed';
                byQuadrant[key].push(s);
            }
            for (const key of Object.keys(buckets) as Array<keyof typeof buckets>) {
                if (byQuadrant[key].length > 0) {
                    buckets[key].push({ ...stock, signals: byQuadrant[key] });
                }
            }
        }
        return buckets;
    }, [sectorStocks]);

    return (
        <section
            aria-label="섹터 신호 탐색"
            aria-live="polite"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-secondary-200 text-sm font-semibold tracking-[0.15em] uppercase">
                    섹터 신호 탐색
                </h2>
                <StrictModeToggle strict={strict} onChange={handleStrictChange} />
            </div>
            <SectorTabs activeSector={activeSector} onChange={handleSectorChange} />
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
                className="mt-6 flex flex-col gap-4"
            >
                <SignalSubsection
                    title="상승 신호"
                    marker="▲"
                    variant="confirmed"
                    stocks={quadrants.bullishConfirmed}
                />
                <SignalSubsection
                    title="상승 조짐"
                    marker="△"
                    variant="expected"
                    stocks={quadrants.bullishExpected}
                />
                <SignalSubsection
                    title="하락 조짐"
                    marker="▽"
                    variant="expected"
                    stocks={quadrants.bearishExpected}
                />
                <SignalSubsection
                    title="하락 신호"
                    marker="▼"
                    variant="confirmed"
                    stocks={quadrants.bearishConfirmed}
                />
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard/SectorSignalPanel.tsx 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 23: `SectorSignalPanelSkeleton`

**Files:**
- Create: `src/components/dashboard/SectorSignalPanelSkeleton.tsx`

- [ ] **Step 1: Create skeleton**

```tsx
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';

export function SectorSignalPanelSkeleton() {
    return (
        <section
            aria-label="섹터 신호 로딩 중"
            aria-busy="true"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex items-center justify-between">
                <div className="bg-secondary-700/50 h-3.5 w-24 animate-pulse rounded" />
                <div className="bg-secondary-700/50 h-3.5 w-20 animate-pulse rounded" />
            </div>
            <div className="flex gap-6 overflow-x-auto border-b border-secondary-700 pb-2">
                {SECTOR_ETFS.map(etf => (
                    <div
                        key={etf.symbol}
                        className="bg-secondary-700/50 h-3 w-12 shrink-0 animate-pulse rounded"
                    />
                ))}
            </div>
            <div className="mt-6 flex flex-col gap-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col gap-3 border-t border-secondary-700 pt-3 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="bg-secondary-700/50 h-3 w-20 animate-pulse rounded" />
                            <div className="bg-secondary-700/50 h-6 w-8 animate-pulse rounded" />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {[0, 1, 2, 3].map(j => (
                                <div
                                    key={j}
                                    className="bg-secondary-800/50 border-secondary-700 h-[120px] animate-pulse rounded-lg border"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 24: `SectorSignalPanelContainer` (RSC)

**Files:**
- Create: `src/components/dashboard/SectorSignalPanelContainer.tsx`

- [ ] **Step 1: Create RSC container**

```tsx
import { getSectorSignals } from '@/infrastructure/dashboard/sectorSignalsApi';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';
import { SectorSignalPanel } from './SectorSignalPanel';

interface SectorSignalPanelContainerProps {
    initialSector?: string;
    initialStrict: boolean;
}

export async function SectorSignalPanelContainer({
    initialSector,
    initialStrict,
}: SectorSignalPanelContainerProps) {
    const data = await getSectorSignals();
    const fallbackSector = SECTOR_ETFS[0].symbol;
    const sector = (initialSector !== undefined && SECTOR_ETFS.some(e => e.symbol === initialSector))
        ? initialSector
        : fallbackSector;
    return <SectorSignalPanel data={data} initialSector={sector} initialStrict={initialStrict} />;
}
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 25: `SignalTypeGuide` (Thin-Content Block)

**Files:**
- Create: `src/components/dashboard/SignalTypeGuide.tsx`

- [ ] **Step 1: Create component**

```tsx
const ENTRIES = [
    { term: '골든크로스', desc: '단기 이동평균선이 장기 이동평균선을 상향 교차. 상승 추세 진입의 대표적 신호.' },
    { term: '데드크로스', desc: '단기 이동평균선이 장기 이동평균선을 하향 교차. 하락 추세 진입의 대표적 신호.' },
    { term: 'RSI 과매도/과매수', desc: 'RSI 지표가 30 미만(과매도) 또는 70 초과(과매수)일 때. 반등 혹은 조정 가능성.' },
    { term: '볼린저 하단 반등 / 상단 돌파', desc: '가격이 볼린저 하단 터치 후 반등 / 상단 돌파. 추세 지속 또는 과열 신호.' },
    { term: 'RSI 다이버전스', desc: '가격은 새로운 극값을 만드는데 RSI가 따라가지 못함. 추세 전환 전조.' },
    { term: 'MACD 히스토그램 수렴', desc: 'MACD 히스토그램의 크기가 연속 감소. 교차 임박 신호.' },
    { term: '볼린저 스퀴즈', desc: '볼린저 밴드 폭이 최근 6개월 최저 수준으로 축소. 방향성 돌파 임박.' },
    { term: '지지선/저항선 근접', desc: '가격이 MA50 또는 MA200에 근접하면서 반등 혹은 반락 여부를 관찰할 구간.' },
];

export function SignalTypeGuide() {
    return (
        <section className="px-6 py-10 lg:px-[15vw]" aria-labelledby="signal-guide-heading">
            <h2
                id="signal-guide-heading"
                className="text-secondary-200 mb-6 text-sm font-semibold tracking-[0.15em] uppercase"
            >
                신호 유형 가이드
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {ENTRIES.map(e => (
                    <div key={e.term}>
                        <dt className="text-secondary-300 text-sm font-semibold">{e.term}</dt>
                        <dd className="text-secondary-500 text-xs leading-relaxed">{e.desc}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 26: `globals.css` — Reduced Motion + Sector Panel Background

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append utilities**

Append to `src/app/globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}

.sector-panel-bg {
    position: relative;
}

.sector-panel-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(to right, var(--color-secondary-800) 1px, transparent 1px),
        linear-gradient(to bottom, var(--color-secondary-800) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent);
    opacity: 0.35;
    pointer-events: none;
    z-index: -1;
}
```

- [ ] **Step 2: Style lint**

Run: `yarn lint:style 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 3: STOP — ready for review commit**

---

## Task 27: Panel B Refinements

**Files:**
- Modify: `src/components/dashboard/IndexCard.tsx`
- Modify: `src/components/dashboard/BriefingCard.tsx`
- Modify: `src/components/dashboard/MarketSummaryPanel.tsx`

- [ ] **Step 1: Update `IndexCard.tsx`**

Replace the inner `<div>` and the conditional `<Link>` block. Current className:
```
bg-secondary-800/50 border-secondary-700 flex flex-col gap-1 rounded-lg border p-3
```
Updated: same on the base, but the `<Link>` wrapper className changes from `transition-opacity hover:opacity-80` to:
```
touch-manipulation block transition-[background-color,border-color,transform,box-shadow] duration-150 hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px hover:shadow-lg hover:shadow-primary-950/40 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none motion-reduce:hover:transform-none
```
Apply identical hover properties directly to the card `<div>` when no `href` (no Link wrapper). Concretely:

Replace lines 22–72 of `src/components/dashboard/IndexCard.tsx` with:
```tsx
    const cardClasses =
        'bg-secondary-800/50 border border-secondary-700 flex flex-col gap-1 rounded-lg p-3';

    const inner = <div className={cardClasses}>{/* keep existing children */}
        {/* ... existing ticker / delta / name / price markup unchanged ... */}
    </div>;

    if (href) {
        return (
            <Link
                href={href}
                title={`${label} 분석`}
                className={cn(
                    'touch-manipulation block rounded-lg transition-[background-color,border-color,transform,box-shadow] duration-150',
                    'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
                    'hover:shadow-lg hover:shadow-primary-950/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    'motion-reduce:transition-none motion-reduce:hover:transform-none'
                )}
                style={{ transformOrigin: 'center' }}
            >
                {inner}
            </Link>
        );
    }
    return inner;
```

Since we must preserve the existing ticker/delta/name/price markup, apply a smaller targeted edit: keep the `inner` body as it is (lines 22–56), replace only the `<Link>` wrapper on lines 59–68.

- [ ] **Step 2: Update `BriefingCard.tsx`**

- Line ~22: change `'AI 브리핑 생성 중...'` → `'AI 브리핑 생성 중…'`
- Line ~17 (loading wrapper `<div>`): add `role="status" aria-live="polite"`
- Line ~30 (error wrapper `<div>`): add `role="alert"`

Concretely:
```tsx
if (isLoading) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="border-secondary-700/50 rounded-lg border p-4"
        >
            <div className="flex items-center gap-2">
                <div className="bg-secondary-700/50 h-2 w-2 animate-pulse rounded-full" />
                <p className="text-secondary-500 text-sm">
                    AI 브리핑 생성 중…
                </p>
            </div>
        </div>
    );
}

if (error) {
    return (
        <div
            role="alert"
            className="border-secondary-700/50 rounded-lg border p-4"
        >
            <p className="text-chart-bearish text-sm">
                브리핑을 불러오지 못했습니다.
            </p>
        </div>
    );
}
```

- [ ] **Step 3: Update `MarketSummaryPanel.tsx` header tracking**

- Line ~41: change `tracking-wider` → `tracking-[0.15em]`
- Line ~63: change `<p className="text-secondary-500 mb-1.5 text-xs">` → `<p className="text-secondary-500 mb-1.5 text-[10px] tracking-wider uppercase">`

- [ ] **Step 4: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint src/components/dashboard 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 28: `app/market/page.tsx` + HydrationBoundary + Metadata

**Files:**
- Create: `src/app/market/page.tsx`

**Note:** The existing `useMarketSummary` hook should already have a query key — if not, define one in `src/lib/` (pattern: `MARKET_SUMMARY_QUERY_KEY`). Before writing, read:
```
src/components/dashboard/hooks/useMarketSummary.ts  (to find the query key)
```
If the key is inline (not exported), export it from `lib/query-keys.ts` (create if missing) and update the hook to import it. Keep this minimal change.

- [ ] **Step 1: Ensure `MARKET_SUMMARY_QUERY_KEY` is exported**

Read `src/components/dashboard/hooks/useMarketSummary.ts`. If `queryKey` is inline like `['market-summary']`:
- Create `src/lib/query-keys.ts` with:
  ```ts
  export const MARKET_SUMMARY_QUERY_KEY = ['market-summary'] as const;
  ```
- Update the hook to import and use it.

If already exported, skip this step.

- [ ] **Step 2: Create `app/market/page.tsx`**

Content:
```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/components/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/components/dashboard/MarketSummaryPanelSkeleton';
import { SectorSignalPanelContainer } from '@/components/dashboard/SectorSignalPanelContainer';
import { SectorSignalPanelSkeleton } from '@/components/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/components/dashboard/SignalTypeGuide';
import { getMarketSummary } from '@/infrastructure/dashboard/marketSummaryApi';
import { MARKET_SUMMARY_QUERY_KEY } from '@/lib/query-keys';
import { ROOT_KEYWORDS, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
    title: `섹터별 미국 주식 신호 탐색 — 골든크로스·RSI 다이버전스 스캔 | ${SITE_NAME}`,
    description:
        '11개 섹터별 선도 종목의 기술적 신호를 한눈에. 골든크로스·데드크로스·RSI 다이버전스·볼린저 스퀴즈를 AI 없이 실시간 포착. 무료.',
    keywords: [
        ...ROOT_KEYWORDS,
        '섹터 신호',
        '골든크로스 스캐너',
        'RSI 다이버전스',
        '볼린저 스퀴즈',
    ],
    alternates: { canonical: `${SITE_URL}/market` },
    openGraph: {
        title: `섹터별 미국 주식 신호 탐색 | ${SITE_NAME}`,
        description:
            '11개 섹터별 선도 종목의 기술적 신호를 스캔. AI 없이 실시간, 무료.',
        url: `${SITE_URL}/market`,
        siteName: SITE_NAME,
        locale: 'ko_KR',
        type: 'website',
    },
};

interface SearchParams {
    sector?: string;
    strict?: string;
}

export default async function MarketPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;
    const hasQueryVariant =
        params.sector !== undefined || params.strict !== undefined;
    const initialStrict = params.strict !== '0';

    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
        queryKey: MARKET_SUMMARY_QUERY_KEY,
        queryFn: () => getMarketSummary(),
    });

    return (
        <>
            {hasQueryVariant && (
                <meta name="robots" content="noindex, follow" />
            )}
            <h1 className="sr-only">
                미국 주식 기술적 신호 대시보드
            </h1>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                    <MarketSummaryPanel />
                </Suspense>
            </HydrationBoundary>
            <Suspense fallback={<SectorSignalPanelSkeleton />}>
                <SectorSignalPanelContainer
                    initialSector={params.sector}
                    initialStrict={initialStrict}
                />
            </Suspense>
            <SignalTypeGuide />
        </>
    );
}
```

- [ ] **Step 3: Smoke build**

```bash
yarn build 2>&1 | tail -30
```
Expected: build succeeds. If `/market` route emits an error, diagnose and fix before moving on.

- [ ] **Step 4: STOP — ready for review commit**

---

## Task 29: `app/market/opengraph-image.tsx`

**Files:**
- Create: `src/app/market/opengraph-image.tsx`

- [ ] **Step 1: Reference existing OG image**

Read `src/app/opengraph-image.tsx` (homepage) to match style.

- [ ] **Step 2: Create `/market/opengraph-image.tsx`**

```tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#0f172a',
                    color: '#f1f5f9',
                    padding: 80,
                    gap: 32,
                }}
            >
                <div
                    style={{
                        fontSize: 20,
                        letterSpacing: 6,
                        textTransform: 'uppercase',
                        color: '#94a3b8',
                    }}
                >
                    Siglens · /market
                </div>
                <div
                    style={{
                        fontSize: 84,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textAlign: 'center',
                    }}
                >
                    섹터별 미국 주식 기술적 신호
                </div>
                <div
                    style={{
                        fontSize: 28,
                        color: '#cbd5e1',
                        textAlign: 'center',
                    }}
                >
                    골든크로스 · RSI 다이버전스 · 볼린저 스퀴즈 실시간 스캔
                </div>
            </div>
        ),
        { ...size }
    );
}
```

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit 2>&1 | tail -10`
Expected: clean.

- [ ] **Step 4: STOP — ready for review commit**

---

## Task 30: `sitemap.ts` + Home Page Internal Link

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `/market` to sitemap**

In `src/app/sitemap.ts`, add entry right after `SITE_URL` entry (line ~18–24):
```ts
{
    url: `${SITE_URL}/market`,
    lastModified: SITEMAP_DATE,
    changeFrequency: 'daily' as const,
    priority: 0.9,
},
```

- [ ] **Step 2: Add internal link on home page**

Read `src/app/page.tsx` to locate an appropriate section (likely near Hero/CTA area or between StatsBar and TickerCategories). Add a small anchor link:

```tsx
import Link from 'next/link';

// Inside the JSX, near the hero section:
<Link
    href="/market"
    className="text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 text-sm font-semibold tracking-wider uppercase transition-colors"
>
    섹터별 신호 스캐너 →
</Link>
```

If `Link` is not already imported, add the import. Place the link where it naturally fits without disrupting existing layout — wrap with appropriate spacing. If there's an existing CTA area, add this as a secondary link beside the primary CTA.

- [ ] **Step 3: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | tail -10
yarn lint 2>&1 | tail -10
```
Expected: clean.

- [ ] **Step 4: Smoke build**

```bash
yarn build 2>&1 | tail -20
```
Expected: success.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 31: Docs Updates

**Files:**
- Modify: `docs/DOMAIN.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DESIGN.md`

- [ ] **Step 1: Update `docs/DOMAIN.md`**

Add a new section at the end:
```markdown
## Signal Detection

`domain/signals/` contains pure-function signal detectors used by the `/market` page's Panel C.

### Types (`domain/signals/types.ts`)

- `Signal` — `{ type, direction: 'bullish'|'bearish', phase: 'confirmed'|'expected', detectedAt }`
- `TrendState` — `'uptrend' | 'downtrend' | 'sideways'`
- `StockSignalResult` — per-stock result including price, changePercent, trend, and raw signals
- `SectorSignalsResult` — aggregate payload (computedAt + stocks[])

### Modules

- `trend.ts` — `classifyTrend(bars, indicators): TrendState` using EMA20 slope over 20 bars (±3% threshold)
- `confirmed.ts` — 8 detectors: RSI oversold/overbought, Golden/Death cross, MACD bullish/bearish cross, Bollinger lower bounce / upper breakout
- `anticipation.ts` — 8 detectors: RSI regular divergence (bullish/bearish), MACD histogram convergence (bullish/bearish), Bollinger squeeze (bullish/bearish), Support/Resistance proximity (bullish/bearish)
- `index.ts` — `detectSignals(bars, indicators)` aggregator

### Key Constants (`domain/signals/constants.ts`)

- `CROSS_LOOKBACK_BARS = 3` — max bar distance to accept golden/death/MACD cross as recent
- `DIVERGENCE_LOOKBACK_BARS = 20`, `DIVERGENCE_FRESHNESS_BARS = 5`, `PIVOT_WINDOW = 2`
- `HISTOGRAM_CONVERGENCE_BARS = 5`
- `SQUEEZE_LOOKBACK_BARS = 120`, `SQUEEZE_PERCENTILE = 0.1`, `SQUEEZE_PCT_B_THRESHOLD = 0.5`
- `TREND_SLOPE_LOOKBACK = 20`, `TREND_SLOPE_THRESHOLD = 0.03`
- `SR_PROXIMITY_PCT = 0.02`, `SR_APPROACH_LOOKBACK = 5`

### Trend Gate (Strict Mode)

Anticipation signals are NOT gated at the domain level. The UI applies a strict-mode filter:
- Strict ON + `expected` bullish → only visible when `trend !== 'uptrend'`
- Strict ON + `expected` bearish → only visible when `trend !== 'downtrend'`
- Strict OFF → all signals visible
- Confirmed signals → always visible
```

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

Add under the "Folder Structure" / layer section:
```markdown
### domain/signals/

Pure-function signal detectors for the `/market` page Panel C. Follows the same rules as `domain/indicators/`.

### components/dashboard/

React components for `/market` page and the homepage's market summary card. Contains Panel B (MarketSummaryPanel family) and Panel C (SectorSignalPanel family).

### infrastructure/dashboard/

Server-side data orchestration for the dashboard:
- `marketSummaryApi.ts` — indices/sectors/briefing fetch
- `sectorSignalsApi.ts` — batch stock bars + indicators + signal detection + Upstash cache (TTL 1h)
```

- [ ] **Step 3: Update `docs/DESIGN.md`**

Add a new section at the end:
```markdown
## Dashboard Panel C — Signal Quadrants

Four subsections per sector: `상승 신호 / 상승 조짐 / 하락 조짐 / 하락 신호`.

### Visual System — "Terminal Editorial"

Distinction uses three orthogonal cues (not emotional color):
- **Marker shape**: filled ▲▼ for confirmed signals, outlined △▽ for anticipation
- **Top rule**: `border-t-2 border-secondary-600` solid (confirmed), `border-t border-dashed border-secondary-700` (anticipation)
- **Label typography**: `font-semibold tracking-[0.15em]` (confirmed), `font-medium tracking-[0.15em] opacity-70` (anticipation)

Price delta chips remain the only use of `text-chart-bullish` / `text-chart-bearish`. Subsection headers are neutral (`text-secondary-200`).

### Cards

`SignalStockCard` extends `IndexCard` language: mono ticker, tabular-nums price, signal badges as tracked uppercase labels with `·` bullet separator. Hover uses `-translate-y-px` + background/border shift, not `opacity-80`.

### Background

`.sector-panel-bg` utility applies a subtle 32px grid with radial mask — terminal atmosphere at opacity 0.35.

### Accessibility

- Sector tabs: WAI-ARIA tablist, Left/Right/Home/End key nav
- Strict mode toggle: radiogroup, Left/Right key toggle
- All ▲▼ markers `aria-hidden` with `sr-only` direction text
- `prefers-reduced-motion`: global utility in `globals.css` disables all transitions/animations
```

- [ ] **Step 4: Type-check / verify docs render**

```bash
yarn lint 2>&1 | tail -5
```
No lint impact from docs. Just spot-check markdown renders cleanly.

- [ ] **Step 5: STOP — ready for review commit**

---

## Task 32: Full Validation

**Files:** none (CI-style end-to-end)

- [ ] **Step 1: Format**

```bash
yarn format 2>&1 | grep -v "unchanged" | tail -20
```
Expected: no unexpected changes beyond any whitespace adjustments to new files.

- [ ] **Step 2: Lint**

```bash
yarn lint 2>&1 | tail -20
yarn lint:style 2>&1 | tail -10
```
Expected: clean on both.

- [ ] **Step 3: Full test suite**

```bash
yarn test 2>&1 | tail -30
```
Expected: all pass.

- [ ] **Step 4: Coverage report for domain + infrastructure**

```bash
yarn test --coverage \
    --collectCoverageFrom='src/domain/signals/**/*.ts' \
    --collectCoverageFrom='src/infrastructure/dashboard/sectorSignalsApi.ts' \
    --testPathPatterns='signals|sectorSignalsApi' 2>&1 | tail -20
```
Expected: 100% statements, 100% branches. If below 100%, add the missing test(s) before proceeding.

- [ ] **Step 5: Build**

```bash
yarn build 2>&1 | tail -30
```
Expected: build succeeds with no warnings related to new files/routes. `/market` route appears in the output.

- [ ] **Step 6: Dev server smoke test**

```bash
yarn dev &
sleep 12
curl -s http://localhost:4200/market | head -30
curl -s 'http://localhost:4200/market?sector=XLK&strict=0' | head -20
kill %1 2>/dev/null
```
Expected: HTML response contains `<h1` (sr-only heading) and the `<meta name="robots" content="noindex, follow">` on the query-variant URL.

- [ ] **Step 7: Final report**

Summarize to user:
- All domain + infrastructure tests green, 100% coverage
- Lint/style/format clean
- Build succeeds
- `/market` route renders on dev server

Then hand off to orchestrator to invoke review-agent per `docs/ISSUE_IMPL_FLOW.md`.

---

## Appendix — Self-Review Notes

### Spec Coverage Check

Walked through both specs; each requirement maps to a task:

| Spec Item | Task |
|---|---|
| types.ts | 1 |
| constants.ts | 2 |
| SECTOR_STOCKS | 3 |
| classifyTrend | 4 |
| 8 confirmed detectors | 5–8 |
| Anticipation helpers | 9 |
| 8 anticipation detectors | 10–13 |
| detectSignals aggregator | 14 |
| Cache + FMP batch | 15 |
| Strict mode toggle | 16, 21 |
| Badge/card/subsection/tabs | 17–21 |
| Panel main logic | 22 |
| Skeleton | 23 |
| RSC container | 24 |
| Thin content | 25 |
| globals.css | 26 |
| Panel B refinements | 27 |
| /market page + HydrationBoundary | 28 |
| OG image | 29 |
| sitemap + home link | 30 |
| Docs | 31 |
| Validation | 32 |

### Type Consistency

- `SectorStock` defined in `domain/types.ts` (Task 1), used in `dashboard-tickers.ts` (Task 3), `sectorSignalsApi.ts` (Task 15)
- `Signal`, `StockSignalResult`, `SectorSignalsResult` defined in `domain/signals/types.ts` (Task 1), re-exported from `domain/types.ts` (Task 15 Step 4), used in components (Tasks 17–24)
- Detector signatures consistent: `(bars: Bar[], indicators: IndicatorResult) => Signal | null`
- `classifyTrend(bars, indicators): TrendState` — signature matches caller in `sectorSignalsApi.ts`

### Known Simplifications

- MA50 computed per-detector (not cached in IndicatorResult) — acceptable for 90-stock cache-miss batch
- `useStrictModeToggle` uses `useState` + lazy initializer, not `useSyncExternalStore`. SSR-safe because server always uses `initialStrict`, client re-reads on mount. If external sync concerns arise (multiple tabs), upgrade later.
- No concurrency limit on `Promise.allSettled` of 90 stocks. If FMP 429s appear in production logs, add `p-limit` in a follow-up.
