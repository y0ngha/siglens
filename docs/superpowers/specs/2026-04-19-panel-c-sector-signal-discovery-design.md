# Panel C — Sector Signal Discovery (신호 + 조짐) — Design Spec

**Date:** 2026-04-19
**Status:** Draft
**Related Issue:** [#329](https://github.com/y0ngha/siglens/issues/329)
**Supersedes Panel C section of:** `docs/superpowers/specs/2026-04-18-market-overview-dashboard-design.md`

---

## Overview

`/market` 페이지의 신규 Panel — 11개 섹터 × 선도 종목의 기술적 신호를 스캔한다. 기존 이슈 #329 스펙(확정 신호)에 더해 **"상승 조짐 / 하락 조짐"** 선행 신호 카테고리를 추가하여 4분면 구조로 분류한다.

- **신호**: 이미 발생한 기술적 패턴 (Golden Cross, RSI 과매도/과매수, BB 반등·돌파, MACD 교차)
- **조짐**: 아직 확정 패턴은 없지만 전조 포착 (다이버전스, 히스토그램 수렴, BB 스퀴즈, S/R 근접)

엄격 모드(기본 ON) 활성화 시, "조짐"은 **현재 추세가 보합 또는 역방향인 경우에만** 노출된다 (이미 강하게 움직이는 종목에서의 조짐은 필터).

---

## Goals / Non-Goals

### Goals
- 4분면 (상승 신호 / 상승 조짐 / 하락 조짐 / 하락 신호) 을 섹터 탭 내에서 스캔 가능
- 모든 감지는 순수 TypeScript 지표 (AI 미사용)
- Upstash Redis 1시간 캐시 + `Promise.allSettled` 장애 격리
- FMP provider (기존 `MarketDataProvider` 추상화) 재사용
- 기존 `MarketSummaryPanel` (Panel B) 는 /market 에서도 재사용

### Non-Goals
- 실시간 intraday 신호 업데이트 (일봉만)
- Alerts / notifications
- 개인화된 watchlist
- 신호의 백테스트
- 홈 페이지의 기존 Panel B 제거 또는 이동

---

## Architecture

### File Layout

```
src/
├── app/market/
│   └── page.tsx                                      # 신규 RSC
├── components/dashboard/
│   ├── SectorSignalPanel.tsx                         # 신규 client
│   ├── SectorSignalPanelSkeleton.tsx                 # 신규
│   ├── SectorSignalPanelContainer.tsx                # 신규 RSC (데이터 전달 경계)
│   ├── SectorTabs.tsx                                # 신규
│   ├── StrictModeToggle.tsx                          # 신규
│   ├── SignalSubsection.tsx                          # 신규
│   ├── SignalStockCard.tsx                           # 신규
│   ├── SignalBadge.tsx                               # 신규
│   └── hooks/useStrictModeToggle.ts                  # 신규
├── domain/
│   ├── constants/dashboard-tickers.ts                # 기존, SECTOR_STOCKS 추가
│   ├── signals/
│   │   ├── types.ts                                  # 신규
│   │   ├── constants.ts                              # 신규 (임계값)
│   │   ├── trend.ts                                  # 신규 (보합/상승/하락 분류)
│   │   ├── confirmed.ts                              # 신규 (확정 신호 감지기)
│   │   ├── anticipation.ts                           # 신규 (예상 신호 감지기)
│   │   └── index.ts                                  # 신규 (집계)
│   └── types.ts                                      # 기존, SectorStock 타입 추가
├── infrastructure/dashboard/
│   └── sectorSignalsApi.ts                           # 신규
├── lib/seo.ts                                        # 기존, market 전용 keyword 추가
└── app/
    ├── sitemap.ts                                    # 수정 — /market 엔트리
    ├── market/opengraph-image.tsx                    # 신규
    └── page.tsx                                      # 수정 — /market 내부 링크

src/__tests__/
├── domain/signals/
│   ├── trend.test.ts
│   ├── confirmed.test.ts
│   ├── anticipation.test.ts
│   └── index.test.ts
├── infrastructure/dashboard/
│   └── sectorSignalsApi.test.ts
└── components/dashboard/
    ├── SectorSignalPanel.test.tsx
    ├── SignalStockCard.test.tsx
    └── hooks/useStrictModeToggle.test.ts
```

### Layer Rules

| Layer | 허용 | 규칙 |
|---|---|---|
| `domain/signals/` | 순수 TypeScript 만 | 외부 import 금지, side effect 금지, 불변성 |
| `infrastructure/dashboard/` | domain import 가능 | FMP provider 추상화 재사용, Upstash 캐시 |
| `components/dashboard/` | domain, lib import 가능 | infrastructure 직접 import 금지 (RSC 에서 props 주입) |
| `app/market/` | infrastructure, domain, lib | 비즈니스 로직 구현 금지 (라우팅/메타데이터만) |

---

## Domain Model

### `domain/signals/types.ts`

```ts
export type SignalDirection = 'bullish' | 'bearish';
export type SignalPhase = 'confirmed' | 'expected';  // UI: 신호 / 조짐

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
    readonly detectedAt: number;         // bar index
}

export type TrendState = 'uptrend' | 'downtrend' | 'sideways';

export interface StockSignalResult {
    readonly symbol: string;
    readonly koreanName: string;
    readonly sectorSymbol: string;        // XLK, XLF, ...
    readonly price: number;
    readonly changePercent: number;
    readonly trend: TrendState;
    readonly signals: readonly Signal[];  // 게이트 미적용 원본
}

export interface SectorSignalsResult {
    readonly computedAt: string;          // ISO timestamp
    readonly stocks: readonly StockSignalResult[];
}
```

**핵심 결정**:
- `signals` 는 **게이트 미적용 원본**. 엄격 모드 토글은 **클라이언트 필터링** → 서버 캐시 1종류
- `trend` 필드로 클라이언트가 엄격 모드 시 `expected + direction` 조합 필터링
- 모든 타입 `readonly` (도메인 불변성)

### 엄격 모드 필터 규칙 (클라이언트)

| 토글 | Signal phase | 노출 조건 |
|---|---|---|
| ON | `confirmed` | 항상 노출 |
| ON | `expected` bullish | `trend !== 'uptrend'` (보합 또는 하락 중) |
| ON | `expected` bearish | `trend !== 'downtrend'` (보합 또는 상승 중) |
| OFF | 모두 | 항상 노출 |

### `domain/constants/dashboard-tickers.ts` 확장

기존 `MARKET_INDICES`, `SECTOR_ETFS`, `SECTOR_GROUPS` 유지. `SECTOR_STOCKS` 신규 추가:

```ts
export const SECTOR_STOCKS: readonly SectorStock[] = [
    // Technology (XLK)
    { symbol: 'AAPL',  koreanName: '애플',          sectorSymbol: 'XLK' },
    { symbol: 'MSFT',  koreanName: '마이크로소프트', sectorSymbol: 'XLK' },
    // ... ~90 종목
];
```

---

## Signal Detection Algorithms

### Trend Classification (`domain/signals/trend.ts`)

```ts
export function classifyTrend(
    bars: Bar[],
    indicators: IndicatorResult
): TrendState
```

**로직**:
1. EMA20 의 최근 20봉 기울기 계산: `(ema20[last] - ema20[last-20]) / ema20[last-20]`
2. 데이터 부족 시 (`ema20` 또는 `close` null) → `sideways`
3. 분류:
   - `|slope| < 0.03` → `sideways`
   - `slope ≥ 0.03` AND `close[last] > ema20[last]` → `uptrend`
   - `slope ≤ -0.03` AND `close[last] < ema20[last]` → `downtrend`
   - 기울기-가격 위치 불일치 → `sideways`

### Confirmed Signals (`domain/signals/confirmed.ts`)

각 감지기: `(bars, indicators) → Signal | null`.

| 감지기 | 조건 |
|---|---|
| `detectRsiOversold` | `rsi[last] < 30` |
| `detectRsiOverbought` | `rsi[last] > 70` |
| `detectGoldenCross` | 최근 3봉 내 `MA20` 이 `MA50` 을 상향 교차 |
| `detectDeathCross` | 최근 3봉 내 `MA20` 이 `MA50` 을 하향 교차 |
| `detectMacdBullishCross` | 최근 3봉 내 MACD line > signal line 교차 |
| `detectMacdBearishCross` | 최근 3봉 내 MACD line < signal line 교차 |
| `detectBollingerLowerBounce` | 전봉 `low ≤ lowerBand` AND 현봉 `close > 전봉 close` |
| `detectBollingerUpperBreakout` | 현봉 `close > upperBand` |

### Expected Signals (`domain/signals/anticipation.ts`)

각 감지기: `(bars, indicators) → Signal | null`. Trend gate 없음 (클라이언트 필터).

#### RSI Divergence (regular only)

- **Bullish**: 가격 피벗 low 에서 더 낮은 저점 (`price_low_2 < price_low_1`) AND 해당 피벗 bar 의 RSI 값이 더 높음 (`rsi_at_low_2 > rsi_at_low_1`)
- **Bearish**: 대칭 (피벗 high, RSI 높은 고점 → RSI 낮은 고점)
- **Hidden divergence 는 감지하지 않음** (추세 지속 성격, 의도와 불일치)
- **피벗 정의**: `bars[i].low < bars[i±1].low AND bars[i].low < bars[i±2].low` (좌우 2봉 엄격)
- **신선도**: 둘째 피벗이 최근 5봉 이내
- **최소 피벗**: 20봉 창에 ≥ 2개 없으면 null

#### MACD Histogram Convergence

- **Bullish**: `hist[last..last-4]` 모두 `< 0` AND 절대값 엄격 단조 감소 (타이 불허)
- **Bearish**: `hist[last..last-4]` 모두 `> 0` AND 값 엄격 단조 감소
- 0 포함 시 null → 확정 신호 `macd_bullish_cross` 와 중복 방지

#### Bollinger Squeeze

- `bb_width = (upper - lower) / middle`
- `%B = (close - lower) / (upper - lower)`
- **Bullish**: `bb_width[last]` 가 최근 120봉 대비 하위 10% AND `%B[last] ≥ 0.5` AND EMA20 slope `≥ 0` (3조건 AND)
- **Bearish**: 하위 10% AND `%B[last] < 0.5` AND slope `≤ 0`
- 조건 불충족 시 양방향 모두 null

#### Support / Resistance Proximity

- **Support bullish**: `close[last]` 가 MA50 또는 MA200 보다 **위에 있으면서** 거리 ≤ 2% AND `close[last] < close[last-5]` (최근 5봉 하락)
- **Resistance bearish**: `close[last]` 가 MA50 또는 MA200 보다 **아래에 있으면서** 거리 ≤ 2% AND `close[last] > close[last-5]`

### Aggregator (`domain/signals/index.ts`)

```ts
export function detectSignals(
    bars: Bar[],
    indicators: IndicatorResult
): readonly Signal[]
```

모든 감지기 호출 → null 제외 → 배열 반환.

### Constants (`domain/signals/constants.ts`)

```ts
export const RSI_OVERSOLD_THRESHOLD = 30;
export const RSI_OVERBOUGHT_THRESHOLD = 70;
export const CROSS_LOOKBACK_BARS = 3;
export const DIVERGENCE_LOOKBACK_BARS = 20;
export const DIVERGENCE_FRESHNESS_BARS = 5;
export const PIVOT_WINDOW = 2;
export const HISTOGRAM_CONVERGENCE_BARS = 5;
export const SQUEEZE_LOOKBACK_BARS = 120;
export const SQUEEZE_PERCENTILE = 0.1;
export const SQUEEZE_PCT_B_THRESHOLD = 0.5;
export const TREND_SLOPE_LOOKBACK = 20;
export const TREND_SLOPE_THRESHOLD = 0.03;
export const SR_PROXIMITY_PCT = 0.02;
export const SR_APPROACH_LOOKBACK = 5;
```

---

## Infrastructure & Caching

### `infrastructure/dashboard/sectorSignalsApi.ts`

```ts
export async function getSectorSignals(): Promise<SectorSignalsResult>
```

**처리 흐름**:
1. 캐시 조회: `dashboard:signals:1Day:${YYYY-MM-DD}` (UTC)
2. 캐시 히트 → `JSON.parse` 후 반환
3. 캐시 미스:
   - `provider = createMarketDataProvider()` (기본 FMP)
   - `Promise.allSettled(SECTOR_STOCKS.map(s => provider.getBars({ symbol: s.symbol, timeframe: '1Day', from: ISO(today − 400일) })))`
     - 400일 ≈ 1.5년 (squeeze 120봉 + 공휴일/주말 여유)
     - **fault isolation**: 개별 실패는 해당 종목만 제외, 로깅
   - 성공 종목마다:
     - `calculateIndicators(bars)` (기존)
     - `detectSignals(bars, indicators)` (신규)
     - `classifyTrend(bars, indicators)` (신규)
     - `price = bars.at(-1).close`, `changePercent = (last.close - prev.close) / prev.close * 100`
     - `StockSignalResult` 생성 (signals 비어도 포함 — trend 정보 필요)
   - 필터: `signals.length === 0` 종목 제외
   - `SectorSignalsResult { computedAt: ISO, stocks }` 구성
4. 캐시 저장: TTL 3600s (실패 시 warn 로깅 후 무시 — fail-open)
5. 반환

**FMP 부하 예상**:
- 캐시 미스 1회당 ~90 요청 (FMP 는 multi-symbol historical 미지원)
- 캐시 미스 빈도: 날짜 바뀔 때마다 첫 유저 1회 + TTL 만료 시
- 초기 동시성 제한 없이 `Promise.allSettled` 전부 병렬. 429 발생 시 `p-limit(10)` 추가 (YAGNI)

### 캐시 키

| 키 | TTL | 값 |
|---|---|---|
| `dashboard:signals:1Day:${date}` | 3600s | `SectorSignalsResult` JSON |

단일 캐시: 엄격 모드 토글은 클라이언트 필터이므로 변형 미필요.

### `app/market/page.tsx`

```tsx
export const metadata: Metadata = {
    title: '섹터별 미국 주식 신호 탐색 — 골든크로스·RSI 다이버전스 스캔 | Siglens',
    description: '11개 섹터별 선도 종목의 기술적 신호를 한눈에. 골든크로스·데드크로스·RSI 다이버전스·볼린저 스퀴즈를 AI 없이 실시간 포착. 무료.',
    alternates: { canonical: `${SITE_URL}/market` },
    openGraph: { /* ... */ },
};

export default async function MarketPage({ searchParams }: Props) {
    const { sector, strict } = await searchParams;
    const hasQueryVariant = sector !== undefined || strict !== undefined;

    return (
        <>
            {hasQueryVariant && <meta name="robots" content="noindex, follow" />}
            <h1 className="sr-only">미국 주식 기술적 신호 대시보드</h1>
            <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                <MarketSummaryPanel />
            </Suspense>
            <Suspense fallback={<SectorSignalPanelSkeleton />}>
                <SectorSignalPanelContainer
                    initialSector={sector}
                    initialStrict={strict !== '0'}
                />
            </Suspense>
            <SignalTypeGuide />  {/* thin content 보완 */}
        </>
    );
}
```

`SectorSignalPanelContainer` 는 RSC (`async`) — `getSectorSignals()` 호출 후 결과를 client component `SectorSignalPanel` 에 props 전달.

---

## UI

### 미적 방향

기존 slate 다크 + trust-blue 테마 확장. **"Terminal Editorial"** — 4분면 구분은 **마커 형태 + 룰 스타일 + 타이포그래피 위계**로 처리. 감정적 색은 가격 델타 칩에만 한정 (기존 `text-chart-bullish` / `text-chart-bearish`).

### 4분면 구분 (3축 직교)

| 분면 | 마커 | 서브섹션 상단 룰 | 레이블 타이포 |
|---|---|---|---|
| ▲ 상승 신호 | 채움 삼각형 | `border-t-2 border-secondary-600` (solid) | `font-semibold tracking-[0.15em] uppercase` |
| △ 상승 조짐 | 외곽 삼각형 | `border-t border-dashed border-secondary-700` | `font-medium tracking-[0.15em] uppercase opacity-70` |
| ▽ 하락 조짐 | 외곽 역삼각형 | dashed | `font-medium tracking-[0.15em] uppercase opacity-70` |
| ▼ 하락 신호 | 채움 역삼각형 | solid | `font-semibold tracking-[0.15em] uppercase` |

분면 헤더 색은 중립 (`text-secondary-200`). teal/coral 은 카드 내부 델타 칩에만.

### 컴포넌트별 주요 스펙

#### `SectorSignalPanel` (client, `'use client'`)

- Props: `SectorSignalsResult`, `initialSector`, `initialStrict`
- State: 활성 섹터 심볼, 엄격 모드 — `useSyncExternalStore` 로 URL `searchParams` 와 양방향 동기화
- URL 직렬화: `?sector=XLK&strict=0|1` (strict=1 기본, URL 에 쓸 때 기본값 생략)
- `useRouter().replace(url, { scroll: false })` 로 URL 업데이트
- hydration 안전: 초기 렌더 = props, `useSyncExternalStore` 로 mount 후 동기화
- `role="region"` + `aria-label="섹터 신호 탐색"` + `aria-live="polite"`

#### `SectorTabs`

- 11개 탭, 가로 스크롤 (`overflow-x-auto touch-action-manipulation overscroll-x-contain scroll-smooth snap-x`)
- 스타일: underline 계열 — 활성 `text-secondary-50 border-b-2 border-primary-500 -mb-px`, 비활성 `text-secondary-400 hover:text-secondary-200 transition-colors duration-150`
- 폰트: `text-xs font-semibold tracking-[0.12em] uppercase`
- 탭 바 하단 공용 룰: `border-b border-secondary-700`
- WAI-ARIA `role="tablist"` + 각 탭 `role="tab"` + `aria-selected` + `aria-controls`
- 키보드 네비: Left/Right 화살표 → 인접 탭 이동, Home/End → 처음/끝, Enter/Space → 활성화
- `tabindex`: 활성=0, 비활성=-1
- 터치 타겟 ≥ 44×44px (`py-3 px-4`)

#### `StrictModeToggle`

- Underline 세그먼티드 (탭과 동일 문법)
- 왼쪽 보조 레이블: `<span id="strict-mode-label">모드</span>` (`text-secondary-500 text-[10px] tracking-wider uppercase`)
- 두 옵션: `<button role="radio" aria-checked>` — "엄격" / "완화"
- 컨테이너: `role="radiogroup" aria-labelledby="strict-mode-label"`
- 키보드 네비: Left/Right 화살표 → 토글, 단일 tabstop
- 밑줄 인디케이터 슬라이드: `transition: transform 200ms ease-out`, `prefers-reduced-motion` 시 즉시 이동
- localStorage persist: `siglens:strict-mode` (`'strict' | 'loose'`), 기본 `'strict'`
- SSR: 초기값 props 로 받음 (URL 우선, 그 다음 localStorage)

#### `SignalSubsection`

- Props: `title`, `direction`, `phase`, `stocks`, `trend`? (for 엄격 필터)
- `<h3>` 태그 (`text-pretty`)
- 카운트: `<span class="tabular-nums text-2xl text-secondary-500">` — 2자리 zero-pad (`02`, `01`)
- 빈 상태: `<p class="text-secondary-500 text-xs italic text-center py-4" role="status">오늘은 해당 신호가 없습니다. 다른 섹터를 확인해 보세요.</p>`

#### `SignalStockCard`

- 기존 `IndexCard` 언어 확장
- 상단: ticker (mono, `translate="no"`) + delta chip (`text-chart-bullish` / `text-chart-bearish`, `text-xs`, ▲/▼ 아이콘 `aria-hidden` + `sr-only` 텍스트)
- 중간: 한글명 (`text-secondary-400 min-w-0 truncate`) + 가격 (mono `tabular-nums`, `Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })`)
- 하단: 신호 배지 (`flex flex-wrap gap-x-1.5 gap-y-0.5`)
- 전체를 `<Link href={`/${symbol}`} title={`${koreanName} 분석`}>` 로 래핑
- 호버: `hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px hover:shadow-lg hover:shadow-primary-950/40`
- Transition: 명시 속성 — `transition-[background-color,border-color,transform,box-shadow] duration-150`
- `transform-origin: center`
- `touch-action: manipulation`
- 포커스: `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:rounded-lg`

#### `SignalBadge`

- 텍스트 전용 (no border, no fill)
- `tracking-wider text-[10px] uppercase text-secondary-300`
- `·` 불릿으로 여러 배지 분리
- 한글 레이블 맵 (SIGNAL_BADGE_LABELS): rsi_oversold → "RSI 과매도", golden_cross → "골든크로스" 등

### 섹터 한글명

`SECTOR_ETFS[i].koreanName` 재사용 (기술/금융/에너지/헬스케어/경기소비재/필수소비재/산업재/소재/유틸리티/부동산/통신서비스).

### 반응형 그리드

- base: `grid-cols-1`
- sm: `grid-cols-2 gap-2`
- md: `grid-cols-3`
- lg: `grid-cols-4`
- xl: `grid-cols-5`

### Motion

| 이벤트 | 동작 |
|---|---|
| 섹터 탭 전환 | 그리드 `opacity` 150ms crossfade |
| 모드 토글 | 밑줄 `transition: transform 200ms ease-out` |
| 카드 호버 | `translateY(-1px)` + 명시 속성 transition 150ms |
| 초기 로드 | 4 서브섹션 `animation-delay: 0/80/160/240ms` 스태거 페이드 |

전역 `globals.css` 추가:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

### 배경 텍스처

패널 래퍼에 미세한 그리드 (`opacity 0.35`, radial mask):
```css
.sector-panel-bg {
    background-image:
        linear-gradient(to right, var(--color-secondary-800) 1px, transparent 1px),
        linear-gradient(to bottom, var(--color-secondary-800) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent);
    opacity: 0.35;
}
```

### SEO 통합

- `app/market/page.tsx`: 정적 `metadata` export + canonical = `/market`
- 쿼리 파라미터 변형 (`?sector=...&strict=...`) → `<meta name="robots" content="noindex, follow">`
- `app/market/opengraph-image.tsx` 신규 (1200×630)
- `sitemap.ts` 에 `/market` 엔트리 추가 (`changeFrequency: 'daily'`, `priority: 0.9`)
- 홈 (`app/page.tsx`) 에 `/market` 내부 링크 추가
- 페이지 하단 `SignalTypeGuide` 컴포넌트 — 신호 유형 짧은 설명 (thin content 보완, `<dl>` 마크업)
- `CollectionPage` + `ItemList` JSON-LD — 종목 카드 리스트

### 접근성 체크리스트

- [ ] 모든 icon-only 마커 `aria-hidden` + `sr-only` 텍스트
- [ ] 섹터 탭 WAI-ARIA tablist 패턴
- [ ] 엄격 모드 radiogroup 패턴
- [ ] `<h1>` (페이지) → `<h2>` (Panel B / Panel C) → `<h3>` (서브섹션) 계층
- [ ] Skip link (페이지 레벨)
- [ ] `focus-visible:ring-*` 모든 interactive 요소
- [ ] `touch-action: manipulation` 탭/카드/토글
- [ ] `translate="no"` 티커/심볼/영문 타입코드
- [ ] `prefers-reduced-motion` 전역 대응

---

## Error Handling

| 시나리오 | 처리 |
|---|---|
| FMP 개별 종목 fetch 실패 | `Promise.allSettled` — 해당 종목 제외, `console.warn` |
| FMP 전체 fetch 실패 | `getSectorSignals()` throw → RSC Suspense error boundary |
| bars 부족 (e.g. 상장 초기 종목) | 해당 감지기 `null`, 다른 신호는 정상 |
| 종목의 signals 가 빈 배열 | 필터에서 제외 (사용자에게 안 보임) |
| 섹터에 신호 종목 0개 | 4 서브섹션 모두 "오늘은 해당 신호가 없습니다" |
| Upstash 읽기 실패 | 캐시 미스로 간주, 직접 계산 후 쓰기 시도 |
| Upstash 쓰기 실패 | `console.warn` 만, 응답은 정상 |
| 엄격 모드 localStorage 접근 실패 | 기본 `'strict'` 유지, try/catch |
| trend 판정 불가 | `'sideways'` fallback |

---

## Testing

### Domain (`src/__tests__/domain/signals/`) — 커버리지 100%

#### `trend.test.ts`
- EMA20 미계산 → `sideways`
- 기울기 +5% + 가격 > EMA → `uptrend`
- 기울기 -5% + 가격 < EMA → `downtrend`
- 기울기 ±3% 이내 → `sideways`
- 기울기-가격 위치 불일치 → `sideways`
- bars < TREND_SLOPE_LOOKBACK + 1 → `sideways`

#### `confirmed.test.ts`
- 8 감지기 각각: 조건 만족 → Signal, 미만족 → null, 데이터 부족 → null, 경계값

#### `anticipation.test.ts`
- RSI divergence bullish/bearish: regular 감지 확인, hidden 미감지 확인
- 둘째 피벗이 6봉 이전 → null (신선도)
- 피벗 < 2개 → null
- MACD 히스토그램 수렴: 엄격 음수 5봉 단조 감소 → bullish, 0 포함 → null
- Bollinger squeeze: 3조건 AND 케이스, 조건 1개 누락 각각 → null
- S/R proximity: close 가 MA 위 + 2% 이내 + 5봉 하락 → support bullish 발동

#### `index.test.ts`
- 모든 감지기 호출 통합
- null 필터링
- 빈 bars → 빈 배열

### Infrastructure (`src/__tests__/infrastructure/dashboard/sectorSignalsApi.test.ts`) — 커버리지 100%
- 캐시 히트 → provider 미호출
- 캐시 미스 → provider 호출 + 캐시 저장
- provider 개별 실패 → 나머지 종목 정상 반환
- provider 전체 실패 → throw
- 캐시 저장 실패 → 응답 정상 + warn
- `signals: []` 종목 필터링

### Component
- `SectorSignalPanel`: 엄격 모드 토글 시 필터 로직, 탭 전환, URL 동기화
- `SignalStockCard`: `<Link>` href 검증, 한글명 truncate, 배지 렌더링
- `useStrictModeToggle`: SSR 초기값, localStorage 동기화, 접근 실패 fallback

---

## Documentation Updates

| 문서 | 변경 |
|---|---|
| `docs/DOMAIN.md` | `Signal`, `TrendState`, `StockSignalResult` 타입 + 감지기 카탈로그 + 임계값 상수 |
| `docs/ARCHITECTURE.md` | `domain/signals/` 모듈, `components/dashboard/` 신규 파일, `app/market/` 라우트 |
| `docs/API.md` | 변경 없음 (기존 FMP provider 재사용) |
| `docs/DESIGN.md` | 4분면 시각 시스템, SignalBadge 스타일, Terminal Editorial 방향 |

---

## Out of Scope

- 실시간 intraday 신호
- Alerts / notifications
- Watchlist (auth 필요)
- 신호 백테스트
- Hidden divergence 감지
- OBV/CMF 거래량 다이버전스 (YAGNI)
- 동시성 제한 (`p-limit`) — 429 발생 시 추가
- Panel B 이동 또는 홈에서 제거
