# Market Overview Dashboard — Design Spec

**Date:** 2026-04-18
**Status:** Approved

---

## Overview

A new dashboard page that serves as the entry point for users who don't yet know what to analyze. It provides two panels:

- **[B] Market Summary** — Key indices, sector ETF performance, and a short AI-generated market briefing
- **[C] Sector Signal Discovery** — Sector-grouped leading stocks with technical signal badges; clicking a stock navigates to the existing analysis page

The dashboard requires no login and is designed to attract new users and drive engagement with the core analysis flow.

---

## Page Layout

```
/dashboard  (new route)

┌─────────────────────────────────────────────────────┐
│  [B] Market Summary Panel                           │
│                                                     │
│  S&P500 +0.8%  NASDAQ +1.2%  DOW -0.3%  VIX 18.2  │
│  ─────────────────────────────────────────────────  │
│  Sector bar: Tech +2.1% | Energy -1.4% | ...       │
│  ─────────────────────────────────────────────────  │
│  AI Briefing (1 paragraph, 1hr cache)               │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  [C] Sector Signal Discovery                        │
│                                                     │
│  [Technology] [Financials] [Energy] [Healthcare]... │
│                                                     │
│  AAPL  RSI Oversold ↑                              │
│  NVDA  Golden Cross                                 │
│  MSFT  Bollinger Lower Band Bounce                  │
│  (click → existing /[symbol] analysis page)         │
└─────────────────────────────────────────────────────┘
```

---

## Panel B — Market Summary

### Data Sources

| Symbol | Type | Notes |
|--------|------|-------|
| ^GSPC | Index | S&P 500 |
| ^DJI | Index | Dow Jones |
| ^IXIC | Index | NASDAQ Composite |
| ^VIX | Index | Volatility Index |
| XLK | Sector ETF | Technology |
| XLF | Sector ETF | Financials |
| XLE | Sector ETF | Energy |
| XLV | Sector ETF | Healthcare |
| XLY | Sector ETF | Consumer Discretionary |
| XLP | Sector ETF | Consumer Staples |
| XLI | Sector ETF | Industrials |
| XLB | Sector ETF | Materials |
| XLU | Sector ETF | Utilities |
| XLRE | Sector ETF | Real Estate |
| XLC | Sector ETF | Communication Services |

Global indices (^FTSE, ^N225, ^HSI, ^STOXX50E) are optional and can be added later without design changes.

### Index Re-enablement Scope

Index symbols (^GSPC etc.) are currently disabled in the codebase via commented-out code. Re-enabling is scoped to **internal fetch only**:

- Uncomment `findIndexMatch` and `filterIndexResults` in `getAssetInfoAction.ts`
- The user-facing search bar remains unchanged — indices do not appear in search results
- The dashboard fetches indices via a hardcoded symbol list, bypassing the search path entirely

### AI Briefing

- Input: latest daily bar + key indicator values for all 15 symbols above
- Output: 2–3 sentence market summary (bullish/bearish/neutral tone, key themes)
- Prompt: reuses existing Skills-based prompt structure
- Cache: Upstash Redis, TTL = 1 hour (keyed by date + "1Day" timeframe)
- If cache miss: trigger AI call server-side on page load (RSC Server Component)

### Displayed Data Per Index/Sector

- Current price (or latest close)
- Change % vs previous close
- Direction arrow (up/down/flat)

---

## Panel C — Sector Signal Discovery

### Stock Universe

Hardcoded list: 11 sectors × 8–10 leading stocks = ~90–110 stocks total.

Representative sector groupings (exact list defined in `src/domain/constants/dashboard-tickers.ts`):

| Sector | Example Tickers |
|--------|----------------|
| Technology | AAPL, MSFT, NVDA, AVGO, AMD, ORCL, QCOM, INTC |
| Financials | JPM, BAC, GS, MS, WFC, BLK, V, MA |
| Energy | XOM, CVX, COP, SLB, OXY, EOG |
| Healthcare | UNH, LLY, JNJ, ABBV, MRK, PFE, TMO |
| Consumer Discretionary | AMZN, TSLA, HD, MCD, NKE, LOW |
| Consumer Staples | WMT, COST, PG, KO, PEP, PM |
| Industrials | CAT, HON, UNP, GE, RTX, DE |
| Materials | LIN, APD, ECL, NEM, FCX |
| Utilities | NEE, DUK, SO, AEP, EXC |
| Real Estate | AMT, PLD, EQIX, CCI, PSA |
| Communication Services | GOOGL, META, NFLX, DIS, CMCSA, T |

### Signal Calculation

- No AI involved — uses existing `domain/indicators/` TypeScript functions
- Calculated on 1Day timeframe bars for each stock
- Signal detection is pure code: compare indicator values against threshold conditions

### Signal Types (initial set)

| Signal | Condition |
|--------|-----------|
| RSI Oversold | RSI < 30 |
| RSI Overbought | RSI > 70 |
| Golden Cross | MA20 crossed above MA50 (within last 3 bars) |
| Death Cross | MA20 crossed below MA50 (within last 3 bars) |
| MACD Bullish Cross | MACD line crossed above signal line (within last 3 bars) |
| MACD Bearish Cross | MACD line crossed below signal line (within last 3 bars) |
| Bollinger Lower Bounce | Price touched lower band and closed higher |
| Bollinger Upper Breakout | Price closed above upper band |

A stock can carry multiple signals simultaneously. Stocks with no active signals are hidden from the panel.

### Caching

- Batch indicator calculation result cached in Upstash Redis
- TTL = 1 hour (intraday data is not needed; daily bars change once per day)
- Cache key: `dashboard:signals:1Day:<date>`
- On cache miss: compute all ~100 stocks server-side (RSC Server Component with Suspense)

### UX

- Sector tabs at the top of the panel
- Each stock shown as a card: ticker, name, signal badge(s)
- Click → navigates to `/[symbol]` (existing analysis page) — no new page needed
- If a sector has no stocks with active signals: show "No signals today" placeholder

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/page.tsx` | RSC page — fetches and passes data to client |
| `src/components/dashboard/MarketSummaryPanel.tsx` | Panel B component |
| `src/components/dashboard/SectorSignalPanel.tsx` | Panel C component |
| `src/components/dashboard/IndexCard.tsx` | Single index/ETF card |
| `src/components/dashboard/SignalStockCard.tsx` | Single stock signal card |
| `src/domain/constants/dashboard-tickers.ts` | Hardcoded index list + sector stock list |
| `src/domain/signals/detectSignals.ts` | Pure function: bar[] + indicators → Signal[] |
| `src/infrastructure/dashboard/marketSummaryApi.ts` | Fetch + cache logic for Panel B |
| `src/infrastructure/dashboard/sectorSignalsApi.ts` | Batch fetch + cache logic for Panel C |

### Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/ticker/getAssetInfoAction.ts` | Uncomment index support (internal fetch only) |

### Layer Rules

- `domain/signals/detectSignals.ts` — pure function, no external imports
- `domain/constants/dashboard-tickers.ts` — pure constants
- `infrastructure/dashboard/` — may import from domain, handles API + cache
- `components/dashboard/` — may import from domain and lib; no direct infrastructure imports
- `app/dashboard/page.tsx` — RSC, imports from infrastructure

---

## Caching Summary

| Data | Cache Key Pattern | TTL |
|------|------------------|-----|
| Index/sector prices (Panel B) | `dashboard:prices:1Day:<date>` | 1 hour |
| AI briefing text (Panel B) | `dashboard:briefing:1Day:<date>` | 1 hour |
| Sector signals (Panel C) | `dashboard:signals:1Day:<date>` | 1 hour |

---

## Out of Scope

- User-facing index search (search bar remains unchanged)
- Alert / notification system (separate future feature)
- Watchlist persistence (requires auth, separate feature)
- Intraday signal updates (daily bars only for now)
- Backtesting of signals
- Global indices in Panel B (deferred, easy to add later)

---

## UI Refinement — Applied at `/market` Implementation (2026-04-19)

This section was appended when preparing the `/market` page to host both Panel B and Panel C together. Panel C was fully redesigned through three UI skill chains (`frontend-design` → `web-design-guidelines` → `seo-audit`). For cross-page consistency, the same lenses are applied retroactively to Panel B. Findings are grouped by skill perspective.

The full Panel C spec lives at `docs/superpowers/specs/2026-04-19-panel-c-sector-signal-discovery-design.md`. Panel B should align with the "Terminal Editorial" visual language defined there when reused at `/market`.

### frontend-design — 시각 언어 정렬

Panel B 는 이미 "Terminal Editorial" 방향과 상당 부분 정렬되어 있음 (tracking-wider uppercase 섹션 헤더, mono ticker, slate 팔레트, teal/coral 델타). 다만 아래 항목을 Panel C 와 동일 리듬으로 맞춤:

- **섹션 헤더 tracking**: Panel C 서브섹션은 `tracking-[0.15em]`. Panel B 의 "시장 현황" 은 `tracking-wider` (≈0.05em). 동일 값으로 맞춤 (`tracking-[0.15em]`)
- **섹터 그룹 라벨 (성장/경기민감/방어)**: 현재 `text-xs text-secondary-500`. Panel C 와 같이 `text-[10px] tracking-wider uppercase text-secondary-500` 로 편집
- **`BriefingCard` 테마 칩**: 현재 `bg-secondary-700/50 rounded px-2 py-0.5 text-xs`. Panel C 의 `SignalBadge` 와 구분 유지 (테마 칩은 label 성격, 신호 배지는 reference 성격이므로 스타일을 의도적으로 다르게 유지). 단, 대소문자/트래킹은 정렬:
  - 유지: `bg-secondary-700/50 rounded px-2 py-0.5`
  - 추가: `tracking-wide`, 색상 `text-secondary-300`
- **`IndexCard` 호버 상태**: 현재 `hover:opacity-80` → 대비 저하 위험. Panel C 카드와 동일하게:
  - `hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px hover:shadow-lg hover:shadow-primary-950/40`
  - `transition-[background-color,border-color,transform,box-shadow] duration-150`
  - `transform-origin: center`
- **카드 보더**: 현재 `border-secondary-700` 유지 (terminal hairline feel)
- **섹션 패딩**: `px-6 py-10 lg:px-[15vw]` 는 Panel C 와 동일하게 적용 — `/market` 에서 Panel B → Panel C 수직 리듬 일치
- **배경 그리드 텍스처 (선택)**: Panel C 와 동일한 `.sector-panel-bg` 유틸을 Panel B 섹션에도 적용 고려. 페이지 전체에 낮은 opacity 그리드가 깔려 터미널 인상 강화. 홈 페이지에서는 미적용 (홈은 별도 hero-grid 사용), /market 에서만 적용

### web-design-guidelines — 접근성·모션·디테일

`MarketSummaryPanel.tsx`, `IndexCard.tsx`, `BriefingCard.tsx`, `MarketSummaryPanelSkeleton.tsx` 검토 결과:

- `BriefingCard.tsx:22` — `AI 브리핑 생성 중...` 에서 `...` → `…` (ellipsis character)
- `BriefingCard.tsx:16-27` — 로딩 상태에 `role="status" aria-live="polite"` 누락 — 추가
- `BriefingCard.tsx:29-37` — 에러 상태에 `role="alert"` 누락 — 추가
- `IndexCard.tsx:~60` — `hover:opacity-80` 는 대비 저하 가능 (특히 반투명 배경 위). 위 frontend-design 에서 제안한 배경/보더 변경으로 교체
- `IndexCard.tsx` — `touch-action: manipulation` 클래스 누락 (링크 카드) — 추가
- `IndexCard.tsx:62` — `transition-opacity` → `transition-[background-color,border-color,transform,box-shadow]` (명시 속성 리스트)
- `MarketSummaryPanelSkeleton.tsx:19,33,40` — `animate-pulse` 는 `prefers-reduced-motion` 시 Tailwind 기본 비활성화되지만, 전역 `@media (prefers-reduced-motion: reduce)` 유틸이 들어오면 중복 안전 (Panel C 스펙의 전역 규칙 적용 시 자동 커버)
- `MarketSummaryPanel.tsx:41` — `<h2>시장 현황</h2>` 은 OK. `/market` 페이지에서는 Panel B 와 Panel C 모두 `<h2>` — 페이지 최상단에 `<h1>` 필수 (Panel C 스펙에서 이미 명시한 `sr-only` h1 이 이를 커버)
- `MarketSummaryPanel.tsx` — `aria-live="polite"` ✅ 이미 적용
- `IndexCard.tsx` — `translate="no"` ✅ 이미 적용
- `IndexCard.tsx` — `sr-only` 상승/하락 텍스트 ✅ 이미 적용
- `BriefingCard.tsx:124-131` — `new Date(generatedAt).toLocaleString('ko-KR', ...)` ✅ Intl 사용 OK. SSR hydration 위험 낮음 (클라이언트 전용 데이터)

### seo-audit — /market 재사용 시 SSR/인덱싱

가장 중요한 변경: **HydrationBoundary 패턴 적용**.

현재 `MarketSummaryPanel` 은 `'use client'` + `useMarketSummary()` 로 클라이언트 사이드 fetch. 홈(`/`) 에서는 이대로 두지만, `/market` 에서는 초기 HTML 에 데이터가 포함되어야 SEO·LCP 모두 유리하다. 프로젝트 `src/app/CLAUDE.md` 의 Data Flow 규칙과 일치시킴.

**구현 가이드**:
```tsx
// app/market/page.tsx (개념 예시)
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getMarketSummary } from '@/infrastructure/dashboard/marketSummaryApi';

export default async function MarketPage({ searchParams }: Props) {
    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
        queryKey: MARKET_SUMMARY_QUERY_KEY,  // lib/ 에서 재사용
        queryFn: () => getMarketSummary(),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <h1 className="sr-only">미국 주식 기술적 신호 대시보드</h1>
            <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                <MarketSummaryPanel />
            </Suspense>
            <Suspense fallback={<SectorSignalPanelSkeleton />}>
                <SectorSignalPanelContainer ... />
            </Suspense>
            <SignalTypeGuide />
        </HydrationBoundary>
    );
}
```

- Panel B: HydrationBoundary — 인덱스/섹터 ETF 데이터가 초기 HTML 에 포함
- Panel C: RSC 직접 fetch (props 전달) — 일회성 서버 계산 결과이므로 단순 pattern
- 두 패턴 혼합 허용 (각각 데이터 성격에 최적)

**AI 브리핑 SSR 고려**:
- 홈에서는 `useBriefing` 훅이 cached/submitted 상태 분기로 동작 (jobId 기반 polling)
- `/market` 에서도 동일 동작 유지 — briefing 은 캐시 히트 시 즉시 표시, 미스 시 비동기 (SEO 관점에서 briefing 자체는 non-critical, 주요 랭킹 요소는 아님)

**추가 SEO 통합 (Panel C 스펙과 동일)**:
- `/market` 의 `<meta robots>` 분기는 Panel C 스펙 (쿼리 변형 noindex) 에서 이미 처리
- `sitemap.ts` 의 `/market` 엔트리는 Panel C 스펙에서 처리
- 홈에서 `/market` 으로의 내부 링크 추가는 Panel C 스펙에서 처리
- Panel B 자체의 JSON-LD: 선택적으로 `Dataset` 또는 `FinancialProduct` 스키마 추가 가능 (여력되면). 이득은 제한적 — YAGNI, 필요 시 후속 작업

### 교차 페이지 구조 규칙 (`/market` 레벨)

- 최상단 `<h1 class="sr-only">` — Panel C 스펙에서 이미 정의
- `<h2>` = 각 Panel 최상단 (Panel B: "시장 현황", Panel C: "섹터 신호 탐색")
- `<h3>` = Panel 내부 섹션 (Panel C 의 섹터명 + 서브섹션). Panel B 는 섹터 그룹 라벨이 문단 성격이라 현재 `<p>` 유지 — 필요시 `<h3>` 로 승격 고려 (그러나 현재 계층 OK)
- 전역 `@media (prefers-reduced-motion: reduce)` 유틸은 globals.css 에 단 1회만 추가 (Panel B/C 공용)
- `sector-panel-bg` 배경 유틸은 `/market` 페이지 루트 wrapper 에 적용, 두 Panel 모두 커버

### 결론 — Panel B 변경 범위

`/market` 구현 시 Panel B 에 요구되는 최소 변경:

1. `IndexCard.tsx` — hover 상태 교체, 명시 transition, touch-action 추가
2. `BriefingCard.tsx` — `...` → `…`, loading/error role ARIA 추가
3. 섹터 그룹 라벨 타이포 조정 (`text-[10px] tracking-wider uppercase`)
4. `/market/page.tsx` 에서 HydrationBoundary 로 MarketSummaryPanel 래핑
5. 홈(`/`) 은 변경 최소화 — 상기 1~3번 코드 변경은 홈에도 적용되나 behavioral 동일, 시각 차이 미미

위 변경은 `/market` 페이지 구현 PR 에서 Panel C 구현과 함께 처리.

