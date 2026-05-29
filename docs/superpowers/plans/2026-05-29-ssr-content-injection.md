# chart·overall SSR 콘텐츠 주입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chart·overall 종목 페이지가 봇에게 진짜 고유 콘텐츠(실측 기술 지표 + 캐시된 AI 결론)를 SSR HTML로 노출하도록 해 thin-content 품질 리스크를 해소한다.

**Architecture:** 2층 구조. (1) **사실 층** — chart 페이지가 이미 prefetch한 bars/indicators로 결정적 기술 지표 텍스트를 항상 SSR(LLM 무관). (2) **서사 층** — siglens-core의 read-only `peek*` getter로 캐시를 읽어, 캐시 HIT일 때만 `initialAnalysis`로 seed해 기존 컴포넌트가 SSR 렌더. 봇은 어떤 경로로도 LLM 생성을 트리거하지 않는다(peek read-only + `skipEnqueueIfMiss=isBot`). 모킹/가짜 분석 절대 금지.

**Tech Stack:** Next.js 16 App Router(RSC), React 19, TanStack Query(useSuspenseQuery/HydrationBoundary), vitest, `@y0ngha/siglens-core`(외주 도메인 패키지).

**프로젝트 규칙 주의:**
- **커밋은 직접 하지 않는다.** 각 Task 끝의 commit 단계는 논리적 체크포인트이며, 실제 커밋/푸시는 구현·리뷰 완료 후 `git-agent`가 수행한다(CLAUDE.md). 구현 종료 시 `review-agent` 호출 필수.
- FSD 레이어 의존 방향 준수. `@y0ngha/siglens-core` deep import 금지(barrel만).
- siglens-core 변경(Phase 0)은 사용자가 직접 구현·publish한다(Claude는 배포 명령 실행 안 함).
- 멀티라인 주석/JSDoc 허용(Documentation Policy Override). WHY 보존 권장.

**참조 스펙:** `docs/superpowers/specs/2026-05-29-ssr-content-injection-design.md`

---

## 파일 구조 (생성/수정)

| 파일 | 책임 | Phase |
|---|---|---|
| `src/entities/chat-message/lib/fallbackAnalysis.ts` (수정) | `isFallbackAnalysis` 술어 추가 | A |
| `src/entities/chat-message/index.ts` (수정) | `isFallbackAnalysis` barrel export | A |
| `src/widgets/symbol-page/utils/technicalFacts.ts` (생성) | bars/indicators → 결정적 사실 추출 순수 함수 | A |
| `src/widgets/symbol-page/TechnicalFactsSummary.tsx` (생성) | 사실을 크롤 가능 텍스트로 렌더 | A |
| `src/widgets/symbol-page/ChartContent.tsx` (수정) | 패널 슬롯 규칙: no-narrative → 사실 층 | A |
| `(siglens-core) peekAnalysisCache / peekOverallAnalysisCache` | read-only 캐시 getter | 0 (사용자) |
| `src/app/[symbol]/page.tsx` (수정) | peek → `initialAnalysis` seed (병렬) | B |
| `src/app/[symbol]/overall/page.tsx` (수정) | peek → `OverallContent` initialAnalysis prop | C |
| `src/widgets/overall/OverallContent.tsx` (수정) | `initialAnalysis` prop 추가·전달 | C |
| `src/widgets/overall/hooks/useOverallAnalysis.ts` (수정) | `initialResult` seed(initialData + triggered) | C |

각 생성/수정 파일에 colocated 테스트(`__tests__/`)를 둔다.

---

## Phase A — chart 사실 층 (core 무관, 먼저 착수)

> cold-miss(캐시 없음) chart 페이지도 진짜 고유 콘텐츠를 SSR하게 만든다. core 릴리스 불필요. 단독으로 동작·테스트 가능.

### Task A1: `isFallbackAnalysis` 술어

슬롯 규칙(A4)이 "AI 서사 보유 여부"를 내용 sniffing 없이 판정하기 위한 술어. miss 경로는 `FALLBACK_ANALYSIS` 상수를 **참조 그대로** 전달하므로 reference equality로 판정한다.

**Files:**
- Modify: `src/entities/chat-message/lib/fallbackAnalysis.ts`
- Modify: `src/entities/chat-message/index.ts`
- Test: `src/entities/chat-message/__tests__/fallbackAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/entities/chat-message/__tests__/fallbackAnalysis.test.ts
import { describe, it, expect } from 'vitest';
import { FALLBACK_ANALYSIS, isFallbackAnalysis } from '@/entities/chat-message';

describe('isFallbackAnalysis', () => {
    it('FALLBACK_ANALYSIS 상수(동일 참조)는 true', () => {
        expect(isFallbackAnalysis(FALLBACK_ANALYSIS)).toBe(true);
    });

    it('내용이 같아도 다른 객체(clone)는 false — 참조 계약', () => {
        expect(isFallbackAnalysis({ ...FALLBACK_ANALYSIS })).toBe(false);
    });

    it('실제 분석 결과는 false', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승 추세' };
        expect(isFallbackAnalysis(real)).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/entities/chat-message/__tests__/fallbackAnalysis.test.ts`
Expected: FAIL — `isFallbackAnalysis is not exported`

- [ ] **Step 3: 구현**

`src/entities/chat-message/lib/fallbackAnalysis.ts` 끝에 추가:

```ts
/**
 * `analysis`가 chart 페이지의 "AI 서사 없음" placeholder인지 판정한다.
 * SSR cache-miss 경로(`[symbol]/page.tsx`)는 `FALLBACK_ANALYSIS` 상수를 참조
 * 그대로 `initialAnalysis`로 전달하므로 reference equality로 안전하게 판정한다.
 * 클라이언트가 실제 분석을 받으면 별도 객체로 교체되어 false가 된다.
 */
export function isFallbackAnalysis(analysis: AnalysisResponse): boolean {
    return analysis === FALLBACK_ANALYSIS;
}
```

`src/entities/chat-message/index.ts`에서 `FALLBACK_ANALYSIS`를 export하는 라인에 `isFallbackAnalysis`를 함께 추가한다(같은 모듈에서 re-export).

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/entities/chat-message/__tests__/fallbackAnalysis.test.ts`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent가 수행)

```
feat(chat-message): add isFallbackAnalysis predicate for SSR slot rule
```

---

### Task A2: `buildTechnicalFacts` 순수 함수

bars/indicators에서 결정적 사실(현재가·등락률·RSI·MACD 모멘텀·52주 위치)을 추출. null/부족 데이터 graceful 처리.

**Files:**
- Create: `src/widgets/symbol-page/utils/technicalFacts.ts`
- Test: `src/widgets/symbol-page/__tests__/technicalFacts.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/widgets/symbol-page/__tests__/technicalFacts.test.ts
import { describe, it, expect } from 'vitest';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildTechnicalFacts } from '../utils/technicalFacts';

function bar(close: number, high = close, low = close): Bar {
    return { time: 0, open: close, high, low, close, volume: 100 };
}

// 필요한 indicator 필드만 채운 최소 stub (나머지는 빈 배열/객체).
function indicators(
    partial: Partial<IndicatorResult>
): IndicatorResult {
    return {
        macd: [], bollinger: [], dmi: [], stochastic: [], stochRsi: [],
        rsi: [], cci: [], vwap: [], ma: {}, ema: {}, volumeProfile: null,
        ichimoku: [], atr: [], obv: [], parabolicSar: [], williamsR: [],
        supertrend: [], mfi: [], keltnerChannel: [], cmf: [],
        donchianChannel: [], buySellVolume: [], smc: {} as IndicatorResult['smc'],
        squeezeMomentum: [],
        ...partial,
    };
}

describe('buildTechnicalFacts', () => {
    it('bar가 2개 미만이면 null', () => {
        expect(buildTechnicalFacts([bar(100)], indicators({}))).toBeNull();
    });

    it('현재가·등락률·52주 위치를 산출한다', () => {
        const bars = [bar(100, 120, 90), bar(110, 115, 100)];
        const facts = buildTechnicalFacts(bars, indicators({}));
        expect(facts).not.toBeNull();
        expect(facts!.lastClose).toBe(110);
        expect(facts!.changePercent).toBeCloseTo(10);
        expect(facts!.high52w).toBe(120);
        expect(facts!.low52w).toBe(90);
        expect(facts!.pctFrom52wHigh).toBeCloseTo(((110 - 120) / 120) * 100);
    });

    it('RSI·MACD histogram은 마지막 non-null 값을 쓴다', () => {
        const bars = [bar(100), bar(110)];
        const facts = buildTechnicalFacts(
            bars,
            indicators({
                rsi: [null, 62.5],
                macd: [
                    { macd: null, signal: null, histogram: null },
                    { macd: 1, signal: 0.5, histogram: 0.5 },
                ],
            })
        );
        expect(facts!.rsi).toBe(62.5);
        expect(facts!.macdHistogram).toBe(0.5);
    });

    it('RSI가 전부 null이면 rsi=null', () => {
        const facts = buildTechnicalFacts(
            [bar(100), bar(110)],
            indicators({ rsi: [null, null] })
        );
        expect(facts!.rsi).toBeNull();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/technicalFacts.test.ts`
Expected: FAIL — `buildTechnicalFacts` 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/widgets/symbol-page/utils/technicalFacts.ts
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';

/** chart 사실 층에 표시하는 결정적 기술 지표 묶음. */
export interface TechnicalFacts {
    lastClose: number;
    /** 직전 봉 종가 대비 % 변화. */
    changePercent: number;
    /** 마지막 non-null RSI. 없으면 null. */
    rsi: number | null;
    /** 마지막 non-null MACD histogram. 부호로 모멘텀 방향 판정. 없으면 null. */
    macdHistogram: number | null;
    high52w: number;
    low52w: number;
    /** 52주 고점 대비 % (<= 0). */
    pctFrom52wHigh: number;
    /** 52주 저점 대비 % (>= 0). */
    pctAbove52wLow: number;
}

// 미국 정규장 1년 ≈ 252 거래일. 일봉 기준 52주 윈도.
const TRADING_DAYS_52W = 252;

function lastNonNull(arr: readonly (number | null)[]): number | null {
    for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i];
        if (v !== null) return v;
    }
    return null;
}

/**
 * bars/indicators에서 결정적 사실을 추출한다. bars가 2개 미만이거나 직전
 * 종가가 0이면(등락률 분모 0) null을 반환해 호출부가 섹션을 graceful 생략한다.
 * 순수 함수 — 시간/난수 의존 없음.
 */
export function buildTechnicalFacts(
    bars: readonly Bar[],
    indicators: IndicatorResult
): TechnicalFacts | null {
    if (bars.length < 2) return null;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    if (prev.close === 0) return null;

    const changePercent = ((last.close - prev.close) / prev.close) * 100;
    const window = bars.slice(-TRADING_DAYS_52W);
    const high52w = Math.max(...window.map(b => b.high));
    const low52w = Math.min(...window.map(b => b.low));

    return {
        lastClose: last.close,
        changePercent,
        rsi: lastNonNull(indicators.rsi),
        macdHistogram: lastNonNull(indicators.macd.map(m => m.histogram)),
        high52w,
        low52w,
        pctFrom52wHigh:
            high52w === 0 ? 0 : ((last.close - high52w) / high52w) * 100,
        pctAbove52wLow:
            low52w === 0 ? 0 : ((last.close - low52w) / low52w) * 100,
    };
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/technicalFacts.test.ts`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent)

```
feat(symbol-page): add buildTechnicalFacts deterministic extractor
```

---

### Task A3: `TechnicalFactsSummary` 컴포넌트

사실을 크롤 가능 텍스트(`<dl>`)로 렌더. 데이터 부족 시 null.

**Files:**
- Create: `src/widgets/symbol-page/TechnicalFactsSummary.tsx`
- Test: `src/widgets/symbol-page/__tests__/TechnicalFactsSummary.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/widgets/symbol-page/__tests__/TechnicalFactsSummary.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { TechnicalFactsSummary } from '../TechnicalFactsSummary';

function bar(close: number, high = close, low = close): Bar {
    return { time: 0, open: close, high, low, close, volume: 100 };
}
const emptyIndicators = {
    macd: [], bollinger: [], dmi: [], stochastic: [], stochRsi: [],
    rsi: [], cci: [], vwap: [], ma: {}, ema: {}, volumeProfile: null,
    ichimoku: [], atr: [], obv: [], parabolicSar: [], williamsR: [],
    supertrend: [], mfi: [], keltnerChannel: [], cmf: [],
    donchianChannel: [], buySellVolume: [], smc: {}, squeezeMomentum: [],
} as unknown as IndicatorResult;

describe('TechnicalFactsSummary', () => {
    it('현재가와 RSI를 텍스트로 렌더한다', () => {
        render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100), bar(110)]}
                indicators={{ ...emptyIndicators, rsi: [null, 72] }}
            />
        );
        expect(screen.getByText(/현재가/)).toBeInTheDocument();
        expect(screen.getByText(/\$110/)).toBeInTheDocument();
        expect(screen.getByText(/72/)).toBeInTheDocument();
        expect(screen.getByText(/과매수/)).toBeInTheDocument();
    });

    it('데이터 부족 시 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <TechnicalFactsSummary
                symbol="AAPL"
                bars={[bar(100)]}
                indicators={emptyIndicators}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/TechnicalFactsSummary.test.tsx`
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 3: 구현**

```tsx
// src/widgets/symbol-page/TechnicalFactsSummary.tsx
'use client';

import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { formatUsdCurrency, formatPriceChange } from '@/shared/lib/priceFormat';
import { buildTechnicalFacts } from './utils/technicalFacts';

interface TechnicalFactsSummaryProps {
    symbol: string;
    bars: readonly Bar[];
    indicators: IndicatorResult;
}

function rsiZone(rsi: number): string {
    if (rsi >= 70) return '과매수';
    if (rsi <= 30) return '과매도';
    return '중립';
}

/**
 * AI 서사가 없을 때(cold-miss) AI 패널 슬롯을 채우는 결정적 사실 층.
 * 차트가 시각화하는 것과 동일한 실측 데이터를 크롤 가능한 텍스트로 노출한다
 * (클로킹 아님 — 사용자에게도 동일하게 보임). LLM 비용 0.
 */
export function TechnicalFactsSummary({
    symbol,
    bars,
    indicators,
}: TechnicalFactsSummaryProps) {
    const facts = buildTechnicalFacts(bars, indicators);
    if (!facts) return null;

    const change = formatPriceChange(facts.changePercent);

    return (
        <section
            aria-labelledby="tech-facts-heading"
            className="bg-secondary-800 flex flex-col gap-3 rounded-lg p-4"
        >
            <h2
                id="tech-facts-heading"
                className="text-secondary-200 text-sm font-semibold"
            >
                {symbol} 기술적 지표 요약
            </h2>
            <dl className="text-secondary-300 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">현재가</dt>
                    <dd>
                        {formatUsdCurrency(facts.lastClose)}{' '}
                        <span className={change.colorClass}>
                            {change.arrow} {change.sign}
                            {facts.changePercent.toFixed(2)}%
                        </span>
                    </dd>
                </div>
                {facts.rsi !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">RSI</dt>
                        <dd>
                            {facts.rsi.toFixed(1)} ({rsiZone(facts.rsi)})
                        </dd>
                    </div>
                )}
                {facts.macdHistogram !== null && (
                    <div className="flex justify-between gap-4">
                        <dt className="text-secondary-400">MACD 모멘텀</dt>
                        <dd>{facts.macdHistogram >= 0 ? '상승' : '하락'}</dd>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <dt className="text-secondary-400">52주 위치</dt>
                    <dd>
                        고점 대비 {facts.pctFrom52wHigh.toFixed(1)}%, 저점 대비 +
                        {facts.pctAbove52wLow.toFixed(1)}%
                    </dd>
                </div>
            </dl>
            <p className="text-secondary-500 text-xs">
                AI 종합 분석은 곧 생성됩니다. 위 지표는 실시간 시세 기반 자동
                계산값입니다.
            </p>
        </section>
    );
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/TechnicalFactsSummary.test.tsx`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent)

```
feat(symbol-page): add TechnicalFactsSummary SSR facts component
```

---

### Task A4: ChartContent 슬롯 규칙 연결

AI 서사가 없을 때(`isFallbackAnalysis(analysis)`) AI 패널 슬롯에 `TechnicalFactsSummary`를 렌더. 서사가 있으면 기존 `AnalysisPanel`.

> **UX 변경 주의:** no-narrative 상태에서 기존의 `AnalysisProgress`(상세 대기 UI) 대신 사실 층 + `AnalysisStatusBanner`("AI 분석 중…")가 노출된다. 사용자는 대기 중에도 실측 데이터를 본다(스펙 §4.4 의도). 리뷰 시 이 UX 전환을 확인할 것.

**Files:**
- Modify: `src/widgets/symbol-page/ChartContent.tsx`
- Test: `src/widgets/symbol-page/__tests__/ChartContent.slot.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`useBars`·`useAnalysis`를 mock해 슬롯 분기만 검증한다.

```tsx
// src/widgets/symbol-page/__tests__/ChartContent.slot.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';

// 무거운 차트/하위 훅은 stub. 슬롯 분기에 필요한 useBars/useAnalysis만 제어.
vi.mock('@/widgets/chart', () => ({
    ChartErrorFallback: () => null,
    ChartSkeleton: () => null,
    TimeframeSelector: () => null,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));
vi.mock('../hooks/useBars', () => ({
    useBars: () => ({
        bars: [
            { time: 0, open: 100, high: 120, low: 90, close: 100, volume: 1 },
            { time: 1, open: 100, high: 115, low: 100, close: 110, volume: 1 },
        ],
        indicators: { rsi: [null, 55], macd: [] },
    }),
}));
const baseAnalysis = vi.fn();
vi.mock('../hooks/useAnalysis', () => ({
    useAnalysis: () => baseAnalysis(),
}));
// 그 외 ChartContent가 의존하는 훅들 — 슬롯 분기에 무관한 최소 stub
vi.mock('../hooks/usePanelResize', () => ({
    usePanelResize: () => ({ panelWidth: 360, isDragging: false, handleDragStart: vi.fn(), handleKeyDown: vi.fn() }),
    PANEL_MIN_WIDTH: 280, PANEL_MAX_WIDTH: 600,
}));
vi.mock('../hooks/useActionPricesVisibility', () => ({ useActionPricesVisibility: () => ({ actionPricesVisible: true, setActionPricesVisible: vi.fn() }) }));
vi.mock('../SymbolModelContext', () => ({ useSymbolModel: () => ({ modelId: 'gemini-2.5-flash', isHydrated: true }) }));
vi.mock('../hooks/useAnalysisDerivedData', () => ({ useAnalysisDerivedData: () => ({ clusteredKeyLevels: { support: [], resistance: [] }, validatedActionPrices: [], reconciledActionLines: [] }) }));
vi.mock('../hooks/useAnalysisDisplay', () => ({ useAnalysisDisplay: () => ({ displayAnalyzing: false, handleProgressFinished: vi.fn() }) }));
vi.mock('../hooks/useAnalysisProgress', () => ({ useAnalysisProgress: () => ({ phaseIndex: 0, tipIndex: 0 }) }));
vi.mock('@/features/symbol-chat', () => ({ usePublishSymbolChat: vi.fn() }));
vi.mock('../FearGreedCardMounted', () => ({ FearGreedCardMounted: () => null }));
vi.mock('@/widgets/analysis', () => ({ AnalysisPanel: () => <div data-testid="analysis-panel" /> }));

import { ChartContent } from '../ChartContent';

function analysisReturn(analysis: AnalysisResponse) {
    return {
        analysis,
        analysisResult: analysis === FALLBACK_ANALYSIS ? null : analysis,
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
    };
}

const props = {
    symbol: 'AAPL', companyName: 'Apple', timeframe: '1D' as const,
    timeframeChangeCount: 0, onMobileSheetContent: vi.fn(), fmpSymbol: 'AAPL',
};

beforeEach(() => vi.clearAllMocks());

describe('ChartContent 슬롯 규칙', () => {
    it('FALLBACK(서사 없음)이면 사실 층을 렌더한다', () => {
        baseAnalysis.mockReturnValue(analysisReturn(FALLBACK_ANALYSIS));
        render(<ChartContent {...props} initialAnalysis={FALLBACK_ANALYSIS} initialAnalysisFailed={true} />);
        expect(screen.getAllByText(/기술적 지표 요약/).length).toBeGreaterThan(0);
        expect(screen.queryByTestId('analysis-panel')).toBeNull();
    });

    it('실제 분석(서사 있음)이면 AnalysisPanel을 렌더한다', () => {
        const real = { ...FALLBACK_ANALYSIS, summary: 'AAPL 상승' };
        baseAnalysis.mockReturnValue(analysisReturn(real));
        render(<ChartContent {...props} initialAnalysis={real} initialAnalysisFailed={false} />);
        expect(screen.getAllByTestId('analysis-panel').length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/ChartContent.slot.test.tsx`
Expected: FAIL — FALLBACK일 때도 `analysis-panel`이 렌더됨(현재 무조건 AnalysisPanel)

- [ ] **Step 3: 구현**

`ChartContent.tsx` import에 추가:

```tsx
import { isFallbackAnalysis } from '@/entities/chat-message';
import { TechnicalFactsSummary } from './TechnicalFactsSummary';
```

`analysisContent` useMemo를 슬롯 분기로 교체:

```tsx
const hasNarrative = !isFallbackAnalysis(analysis);

const analysisContent = useMemo(
    () =>
        isBotBlocked ? (
            <BotBlockedNotice />
        ) : !hasNarrative ? (
            // 서사 없음(cold-miss/생성 전) → 결정적 사실 층 + 진행 배너.
            // 봇은 이 사실 텍스트를 색인하고, 사람은 생성 대기 중 실측값을 본다.
            <>
                <AnalysisStatusBanner status={analysisStatus} className="mb-3" />
                <TechnicalFactsSummary
                    symbol={symbol}
                    bars={bars}
                    indicators={indicators}
                />
                <ErrorBoundary fallback={null}>
                    <Suspense fallback={null}>
                        <FearGreedCardMounted
                            symbol={symbol}
                            fmpSymbol={fmpSymbol}
                        />
                    </Suspense>
                </ErrorBoundary>
            </>
        ) : (
            <>
                <AnalysisStatusBanner status={analysisStatus} className="mb-3" />
                <AnalysisPanel
                    symbol={symbol}
                    analysis={analysis}
                    keyLevels={clusteredKeyLevels}
                    timeframe={timeframe}
                    isAnalyzing={isAnalyzing}
                    showProgress={displayAnalyzing}
                    progressPhaseIndex={progressPhaseIndex}
                    progressTipIndex={progressTipIndex}
                    onReanalyze={handleReanalyze}
                    reanalyzeCooldownMs={reanalyzeCooldownMs}
                    cooldownNotice={cooldownNotice}
                    actionPricesVisible={actionPricesVisible}
                    onActionPricesVisibilityChange={setActionPricesVisible}
                />
                <ErrorBoundary fallback={null}>
                    <Suspense fallback={null}>
                        <FearGreedCardMounted
                            symbol={symbol}
                            fmpSymbol={fmpSymbol}
                        />
                    </Suspense>
                </ErrorBoundary>
            </>
        ),
    [
        isBotBlocked,
        hasNarrative,
        bars,
        indicators,
        isAnalyzing,
        symbol,
        analysisStatus,
        analysis,
        clusteredKeyLevels,
        timeframe,
        displayAnalyzing,
        progressPhaseIndex,
        progressTipIndex,
        handleReanalyze,
        reanalyzeCooldownMs,
        cooldownNotice,
        actionPricesVisible,
        setActionPricesVisible,
        fmpSymbol,
    ]
);
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/symbol-page/__tests__/ChartContent.slot.test.tsx`
Expected: PASS

- [ ] **Step 5: 전체 타입·린트 확인**

Run: `yarn lint && yarn test src/widgets/symbol-page`
Expected: PASS

- [ ] **Step 6: commit 체크포인트** (git-agent)

```
feat(symbol-page): render TechnicalFactsSummary in analysis slot when no AI narrative
```

> **Phase A 종료** — 여기까지로 chart cold-miss 페이지가 진짜 사실 텍스트를 SSR한다. core 릴리스 없이 머지 가능. `review-agent` 호출 → 통과 후 git-agent 커밋/PR.

---

## Phase 0 — siglens-core read-only peek getter (사용자 구현·publish)

> **이 Phase는 siglens-core 레포에서 사용자가 직접 구현·publish한다.** siglens는 아래 계약에 맞춰 Phase B·C를 구현한다. Claude는 core 코드 작성·배포를 하지 않는다.

**core가 추가·export해야 하는 계약:**

```ts
// read-only. enqueue / LLM 호출 / marketDataProvider / 그 외 side-effect 없음.
// 내부에서 buildAnalysisCacheKey + cache provider get + deserialize + validate를 수행.
// miss 또는 손상된 캐시 → null.

export function peekAnalysisCache(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string,
    modelId?: ModelId,
): Promise<AnalysisResponse | null>;

export function peekOverallAnalysisCache(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId?: ModelId,
): Promise<OverallAnalysisResponse | null>;
```

**요구사항:**
- Redis(env 설정) 기반 cache provider를 내부에서 생성/사용해 **인자만으로 호출 가능**해야 한다(RSC에서 provider 주입 없이 호출).
- `submitAnalysis` / `submitOverallAnalysis`가 사용하는 캐시 키와 **동일 키**를 조회해야 한다(HIT 일치 보장).
- enqueue·생성 절대 없음(봇 비용 0 불변식).

- [ ] **Step 1:** 사용자가 siglens-core에 `peekAnalysisCache`·`peekOverallAnalysisCache` 구현 + 단위 테스트(HIT/MISS/손상/side-effect 0) 작성.
- [ ] **Step 2:** 사용자가 siglens-core publish.
- [ ] **Step 3:** siglens에서 `yarn add @y0ngha/siglens-core@<new-version>` 후 `node -e "console.log(typeof require('@y0ngha/siglens-core').peekAnalysisCache)"` → `function` 확인.

---

## Phase B — chart 서사 층 seed (Phase 0 publish 후)

> RSC에서 peek로 캐시를 읽어 HIT면 `initialAnalysis`로 seed. `initialAnalysisFailed`는 항상 `true` 유지(클라 자동 재분석 보존 = 순수 가산).

### Task B1: `[symbol]/page.tsx` peek 주입

**Files:**
- Modify: `src/app/[symbol]/page.tsx`
- Test: `src/app/[symbol]/__tests__/page.test.ts` (기존 파일에 케이스 추가)

- [ ] **Step 1: 실패 테스트 작성** — peek HIT/MISS/throw 시 `initialAnalysis` 전달 검증

`SymbolPageClient`를 mock해 전달된 `initialAnalysis` prop을 캡처하고, `@y0ngha/siglens-core`의 `peekAnalysisCache`를 mock한다. (기존 page.test.ts의 mock 구조를 따른다.)

```ts
// 추가 케이스 (기존 page.test.ts의 패턴/모킹 위에 작성)
// - peekAnalysisCache가 cached(AnalysisResponse) 반환 → SymbolPageClient에 그 객체가 initialAnalysis로 전달
// - peekAnalysisCache가 null 반환 → initialAnalysis === FALLBACK_ANALYSIS
// - peekAnalysisCache가 throw → initialAnalysis === FALLBACK_ANALYSIS (크래시 없음)
// 모든 경우 initialAnalysisFailed === true
```

> 구현 주의: 기존 `page.test.ts`가 `SymbolPageClient`·`getAssetInfoCached`·`getBarsAction`·`countSkillFiles`를 어떻게 mock하는지 먼저 읽고 동일 방식으로 `peekAnalysisCache` mock과 prop 캡처를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/app/[symbol]/__tests__/page.test.ts`
Expected: FAIL — peek 미사용으로 항상 FALLBACK 전달

- [ ] **Step 3: 구현**

`src/app/[symbol]/page.tsx`:

import 추가:

```tsx
import { peekAnalysisCache, GEMINI_2_5_FLASH_MODEL } from '@y0ngha/siglens-core';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
```

> `GEMINI_2_5_FLASH_MODEL`이 `SymbolModelContext`의 초기 기본 모델과 동일한지 확인할 것 — SSR seed 키가 클라 기본-모델 키와 일치해야 hydration 후 동일 캐시를 본다. 다르면 `SymbolModelContext` 기본값 상수를 공유 import해 사용.

`SymbolPage` 본문에서 `assetInfo` 확보 후, bars prefetch와 **병렬로** peek:

```tsx
// 기존: const [assetInfo, skillCounts] = await Promise.all([...])
// peek는 read-only Redis GET. bars prefetch와 직렬화하지 않도록 함께 묶는다.
const cachedAnalysis = await peekAnalysisCache(
    ticker,
    initialTimeframe,
    assetInfo.fmpSymbol,
    GEMINI_2_5_FLASH_MODEL
).catch(() => null); // peek 실패는 MISS로 degrade — 렌더는 절대 깨지지 않는다

const initialAnalysis = cachedAnalysis ?? FALLBACK_ANALYSIS;
```

`SymbolPageClient` 호출의 prop 교체:

```tsx
initialAnalysis={initialAnalysis}
// 클라 자동 재분석 보존(순수 가산): HIT여도 true 유지 →
// 사람은 백그라운드 갱신, 봇은 client submit 미실행 + skipEnqueueIfMiss 가드.
initialAnalysisFailed={true}
```

> peek를 `assetInfo`/`countSkillFiles`/`bars prefetch`와 한 `Promise.all`로 묶어 직렬 TTFB 추가를 피한다(단, peek는 `ticker`·`fmpSymbol` 의존이라 `assetInfo` 이후에 가능 — `getAssetInfoCached`는 cached라 비용 작음. 구현 시 의존 순서 고려해 묶을 수 있는 범위까지 병렬화).

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/app/[symbol]/__tests__/page.test.ts`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent)

```
feat(symbol): seed chart analysis from read-only cache peek (SSR)
```

---

## Phase C — overall 서사 층 seed (Phase 0 publish 후)

> overall은 수동 트리거(idle→CTA) 모델. peek HIT면 `initialData`+`triggered` seed로 'done' 상태에서 시작해 SSR에 결론 렌더. 자동 재분석/봇 생성 없음(staleTime Infinity).

### Task C1: `useOverallAnalysis`에 `initialResult` seed

**Files:**
- Modify: `src/widgets/overall/hooks/useOverallAnalysis.ts`
- Test: `src/widgets/overall/__tests__/useOverallAnalysis.seed.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/widgets/overall/__tests__/useOverallAnalysis.seed.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { useOverallAnalysis } from '../hooks/useOverallAnalysis';

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const seeded = { headlineKo: 'AAPL 강세 우위' } as unknown as OverallAnalysisResponse;

describe('useOverallAnalysis seed', () => {
    it('initialResult가 있으면 즉시 done 상태로 시작한다', () => {
        const { result } = renderHook(
            () =>
                useOverallAnalysis('AAPL', 'Apple', '1D', 'gemini-2.5-flash', seeded),
            { wrapper }
        );
        expect(result.current.state.status).toBe('done');
        if (result.current.state.status === 'done') {
            expect(result.current.state.result).toBe(seeded);
        }
    });

    it('initialResult가 없으면 idle로 시작한다', () => {
        const { result } = renderHook(
            () => useOverallAnalysis('AAPL', 'Apple', '1D', 'gemini-2.5-flash'),
            { wrapper }
        );
        expect(result.current.state.status).toBe('idle');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/overall/__tests__/useOverallAnalysis.seed.test.tsx`
Expected: FAIL — 5번째 인자 미지원, seed 없이 idle

- [ ] **Step 3: 구현**

`useOverallAnalysis` 시그니처에 optional `initialResult` 추가:

```ts
export function useOverallAnalysis(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: ModelId,
    initialResult?: OverallAnalysisResponse, // NEW: SSR seed
): UseOverallAnalysisReturn {
```

`triggered` 초기값과 useQuery에 `initialData` 적용:

```ts
// 기존: const [triggered, setTriggered] = useState(false);
const [triggered, setTriggered] = useState(initialResult !== undefined);
```

```ts
const query = useQuery({
    queryKey,
    queryFn: (/* 동일 */) => { /* 동일 */ },
    enabled: isHydrated && triggered,
    retry: false,
    staleTime: Infinity,
    initialData: initialResult, // NEW: seed가 있으면 query.data로 즉시 노출 → SSR 'done'
});
```

> `initialData` + `staleTime: Infinity`이므로 hydration 후에도 자동 refetch 없음(봇 생성 0, 자동 재분석 없음). 사용자는 기존 `trigger`(재분석)로 force refetch 가능 — 동작 불변.

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/overall/__tests__/useOverallAnalysis.seed.test.tsx`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent)

```
feat(overall): seed useOverallAnalysis from initialResult (SSR)
```

---

### Task C2: `OverallContent`에 `initialAnalysis` prop

**Files:**
- Modify: `src/widgets/overall/OverallContent.tsx`
- Test: `src/widgets/overall/__tests__/OverallContent.seed.test.tsx`

- [ ] **Step 1: 실패 테스트 작성** — `initialAnalysis` prop 전달 시 결론 섹션(headline)이 즉시 렌더되는지

```tsx
// useOverallAnalysis를 실제로 쓰되 QueryClientProvider로 감싸 seed 경로 확인.
// 또는 useOverallAnalysis를 mock해 prop 전달만 검증. 기존 OverallContent 테스트
// 패턴(있으면 따름)에 맞춰 작성. 핵심 단언:
// render(<OverallContent symbol="AAPL" companyName="Apple" timeframe="1D" initialAnalysis={seeded} />)
// → screen.getByText(/AAPL 강세 우위/)  (OverallSummary headline)
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/widgets/overall/__tests__/OverallContent.seed.test.tsx`
Expected: FAIL — `initialAnalysis` prop 미지원

- [ ] **Step 3: 구현**

`OverallContentProps`에 prop 추가 + 훅에 전달:

```tsx
import { type OverallAnalysisResponse, type Timeframe } from '@y0ngha/siglens-core';

interface OverallContentProps {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
    initialAnalysis?: OverallAnalysisResponse; // NEW: SSR seed
}

export function OverallContent({
    symbol,
    companyName,
    timeframe,
    initialAnalysis, // NEW
}: OverallContentProps) {
    const modelId = useDefaultModelId();
    const { state, trigger } = useOverallAnalysis(
        symbol,
        companyName,
        timeframe,
        modelId,
        initialAnalysis // NEW
    );
    // ...이하 동일
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/widgets/overall/__tests__/OverallContent.seed.test.tsx`
Expected: PASS

- [ ] **Step 5: commit 체크포인트** (git-agent)

```
feat(overall): accept initialAnalysis prop for SSR seed
```

---

### Task C3: `overall/page.tsx` peek 주입

**Files:**
- Modify: `src/app/[symbol]/overall/page.tsx`
- Test: `src/app/[symbol]/overall/__tests__/page.test.ts` (있으면 케이스 추가, 없으면 생성)

- [ ] **Step 1: 실패 테스트 작성** — peek HIT → `OverallContent`에 `initialAnalysis` 전달 / MISS·throw → 미전달(undefined)

`OverallContent`를 mock해 prop 캡처, `peekOverallAnalysisCache` mock.

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/app/[symbol]/overall/__tests__/page.test.ts`
Expected: FAIL — peek 미사용

- [ ] **Step 3: 구현**

`src/app/[symbol]/overall/page.tsx`:

import 추가:

```tsx
import { peekOverallAnalysisCache, GEMINI_2_5_FLASH_MODEL } from '@y0ngha/siglens-core';
```

`OverallPage` 본문(assetInfo·timeframe 확보 후):

```tsx
const cachedOverall = await peekOverallAnalysisCache(
    upper,
    assetInfo.name,
    timeframe,
    GEMINI_2_5_FLASH_MODEL
).catch(() => null); // MISS로 degrade
```

`OverallContent` 렌더에 prop 추가:

```tsx
<OverallContent
    symbol={upper}
    companyName={assetInfo.name}
    timeframe={timeframe}
    initialAnalysis={cachedOverall ?? undefined}
/>
```

> `companyName`·`timeframe`·`modelId`는 `useOverallAnalysis`의 queryKey 구성요소와 동일해야 seed가 클라 queryKey와 매칭된다(`QUERY_KEYS.overallAnalysis(symbol, companyName, timeframe, modelId)`). RSC의 `assetInfo.name`이 클라 `companyName`(SymbolPage에서 전달되는 값)과 동일한지 확인.

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/app/[symbol]/overall/__tests__/page.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 확인**

Run: `yarn lint && yarn test src/widgets/overall src/app/[symbol]/overall`
Expected: PASS

- [ ] **Step 6: commit 체크포인트** (git-agent)

```
feat(overall): seed overall analysis from read-only cache peek (SSR)
```

---

## 검증 Task: fear-greed SSR 실측 확인

> 설계상 fear-greed는 이미 SSR된다(범위 제외). 가정을 1회 실측 확인한다.

- [ ] **Step 1:** `yarn build && yarn start`(또는 dev) 후, 캐시/데이터가 있는 종목으로 `curl -s http://localhost:4200/AAPL/fear-greed | grep -o '공포 탐욕'` 등으로 점수/라벨 텍스트가 **초기 HTML에 존재**하는지 확인.
- [ ] **Step 2:** 존재하면 OK(조치 없음). 존재하지 않으면 별도 이슈 생성(`issue-agent`) — 본 계획 범위 밖.

---

## Self-Review 결과

- **Spec 커버리지:** §3 아키텍처(2층)→Phase A/B/C, §4 chart(jail·사실층·서사층·슬롯규칙)→A2/A3/A4/B1, §5 overall→C1/C2/C3, §6 동작계약→ B1(initialAnalysisFailed=true)·C1(staleTime Infinity)로 봇 생성 0 보장, §7 엣지(peek throw→FALLBACK)→B1/C3 `.catch(()=>null)`, §8 테스트→각 Task, §9 순서→Phase 0→A→B→C+검증. 누락 없음.
- **Placeholder:** 신규 순수/컴포넌트 단위(A1~A3)는 완전 코드. 기존 파일 수정(A4/B/C)은 정확한 edit 코드 + 기존 mock 패턴 참조 지시. core(Phase 0)는 사용자 구현이라 계약만 명시.
- **타입 일관성:** `isFallbackAnalysis(AnalysisResponse): boolean`, `buildTechnicalFacts(bars, indicators): TechnicalFacts | null`, `peekAnalysisCache(...): Promise<AnalysisResponse|null>`, `peekOverallAnalysisCache(...): Promise<OverallAnalysisResponse|null>`, `useOverallAnalysis(..., initialResult?)` — 전 Task 일관.
- **알려진 확인 필요(구현 시):** (1) `GEMINI_2_5_FLASH_MODEL` == `SymbolModelContext` 기본값, (2) RSC `assetInfo.name` == 클라 `companyName`, (3) 기존 page.test.ts mock 구조.
