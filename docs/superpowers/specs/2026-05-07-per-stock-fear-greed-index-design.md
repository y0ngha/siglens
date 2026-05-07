# Per-Stock Fear & Greed Index — Design

- **Status**: Draft (브레인스토밍 종료, 사용자 리뷰 대기)
- **Author**: y0ngha
- **Date**: 2026-05-07
- **Cross-repo**: 본 디자인은 `@y0ngha/siglens-core`(계산 로직)와 `siglens`(UI/라우트) 양쪽 변경을 수반한다. 머지 순서는 core → siglens.

## 1. 목표

개별 종목의 단기 sentiment를 0~100 단일 점수와 5단계 라벨(EXTREME FEAR / FEAR / NEUTRAL / GREED / EXTREME GREED)로 측정·표시한다. CNN F&G의 *개별주식판*에 해당한다. 시장 전반(VIX·CNN F&G)이 아니라 *해당 종목의 자기 분포 대비* 어디에 있는지를 측정한다.

핵심 비-목표:
- 메가캡 바스켓 기반 자체 시장 게이지 산출 (이번 디자인 제외)
- intraday(1H/4H) 공포지수 (이번 디자인 제외, 일봉 고정)
- 백테스팅 결과 화면 (v2 후속 — 다만 walk-forward 산출은 백테스팅 가능성을 열어둠)

## 2. 알고리즘

### 2.1 입력

```
일봉 Bar[]            (가용 데이터 전부, 최대 ~500 bar — 이미 fetchBarsWithIndicators가 fetch 중)
BuySellVolumeResult[] (이미 indicators에 포함되어 들어옴)
VolumeProfile         (60-bar 윈도우 산출 결과 — core에 이미 존재한다고 추정. 미존재 시 도메인에 추가)
```

### 2.2 5-factor 산출 (raw value)

**Flow group**

| Factor | 식 |
|---|---|
| Volume z (signed) | `z = (volume_t - mean_20) / std_20`, signed = `z × sign(close_t - close_{t-1})` |
| Buy/Sell 불균형 | `(buy_vol - sell_vol) / (buy_vol + sell_vol)` |
| POC 거리 | `(close - POC_60bar) / POC_60bar` |

**Trend group**

| Factor | 식 |
|---|---|
| MA200 거리 | `(close - MA200) / MA200` |
| 52w 위치 | `(close - low_252) / (high_252 - low_252)` — 252-bar 윈도우 high/low는 *현재 bar 포함* (stochastic-like). factor 정의상 결과 0..1로 보장 (현재 close가 신고가 갱신해도 100% 초과 발생 안 함). |

### 2.3 정규화 (Self-normalization)

각 factor → *해당 종목의* 가용 lookback 분포에 대해 percentile 산출 (0~100, GREED 쪽이 100). 예:
- Volume signed z의 percentile이 80 → 가용 표본 중 상위 20% 양의-거래량 (탐욕성)
- POC 거리의 percentile이 5 → 가용 표본 중 하위 5% (가격이 POC 한참 아래 — 공포성)

look-ahead bias 방지: 분포 산출 시 *현재 bar 미포함*, rolling 통계는 직전 N bar. 예외 — 52w 위치는 *factor 자체의 정의*상 현재 bar의 high/low를 포함해 0..1 범위를 보장한다. 이 예외는 raw factor 값에 한정되며, walk-forward percentile 산출 시의 분포는 여전히 *과거 시점까지만* 사용한다 (factor 정의 vs 분포 정의 구분).

### 2.4 합성

```
flow_score  = avg(volume_pctl, buysell_pctl, poc_pctl)
trend_score = avg(ma200_pctl, range_pctl)
score       = 0.5 × flow_score + 0.5 × trend_score   // 0..100
```

5단계 컷오프 (CNN F&G 표준):

```
 0 – 25   EXTREME_FEAR
25 – 45   FEAR
45 – 55   NEUTRAL
55 – 75   GREED
75 – 100  EXTREME_GREED
```

### 2.5 신뢰도 안전장치

```
표본 ≥ 60      → confidence = 'normal'
표본 10 .. 59 → confidence = 'limited' (UI 신뢰도 배지)
표본 < 10      → null 반환 (UI '데이터 부족')
```

### 2.6 결측 처리

- 거래 정지/일자별 buySellVolume 분류 미가능 → 해당 일자 factor 제외, 그룹 평균은 산출 가능한 factor만으로
- 신규 상장 등 분포 표본 < 10 → 산출 보류 (null)

### 2.7 Historical 시계열 (Walk-forward)

각 과거 시점 t에 대해 *t 까지의 데이터만으로* 분포 산출 → t의 factor 값을 그 분포에 비춰 percentile → 5-factor 합성 → t의 점수.

- look-ahead bias 없음
- Warm-up: 처음 60 bar는 표본 부족으로 점수 산출 보류 (시계열 차트 첫 60bar 빈 영역)
- 비용: 500 bar × 5 factor의 walk-forward percentile, ms 단위 — 매 페이지 진입 시 ad-hoc 산출 가능

## 3. 데이터 흐름

### 3.1 Fetch 재사용

`siglens/src/components/symbol-page/hooks/useBars.ts`가 이미 일봉 500 bar를 fetch 중(`TIMEFRAME_BARS_LIMIT['1Day'] = 500`, `node_modules/@y0ngha/siglens-core/dist/domain/constants/market.js:26`). 추가 fetch 없이 동일 React Query 캐시 결과를 재사용한다.

### 3.2 분포 갱신 정책

별도 캐시·DB·cron 신설 없음. 페이지 진입 시 `useBars` 결과로부터 즉석 산출(`useFearGreed` hook). Bar 자체의 staleTime을 그대로 따름.

추후 hot path가 되면 분포 통계량(mean/std/percentile breakpoints + 시계열)을 Redis에 캐시 (이번 디자인 외).

## 4. UI

### 4.1 헤더 chip — `SymbolLayoutHeader.tsx`

`SymbolLayoutHeader`의 우측, `ModelSelector` 옆에 작은 chip을 추가한다. 모든 `/[symbol]/*` 라우트에서 노출되므로 페이지 첫 인상에서 sentiment 인식 가능.

```
┌─────────────────────────────────────────────────────────────┐
│ SIGLENS / 엔비디아, NVIDIA Corp (NVDA)   [🟥 EXTREME FEAR · 18] │
│                                            AI모델 [Sonnet]   │
│ ──────────────────────────────────────────────────────────  │
│ [차트] [뉴스] [펀더] [종합] [공포 지수]                       │
└─────────────────────────────────────────────────────────────┘
```

chip 디자인: 5단계별 컬러 + 라벨 + 점수. confidence === 'insufficient' → "데이터 부족", 'limited' → 점수 + ⓘ 아이콘.

### 4.2 분석 탭 카드 — `AnalysisPanel` 내부

`NewsAugment` 자리(`ChartContent.tsx:181`)에 `FearGreedCard`로 교체. 컴팩트 풀 breakdown:

```
┌─ 공포지수 카드 ──────────────────────────────┐
│  EXTREME FEAR  18 / 100        (반원 게이지) │
│                                              │
│  Flow   ●●●○○  30 (FEAR)                     │
│    · Volume z (signed)  -2.1   98th  매도성  │
│    · Buy/Sell 불균형    -42%   92nd          │
│    · POC 거리(60bar)    -3.2%  95th          │
│                                              │
│  Trend  ●●●●○  40 (FEAR)                     │
│    · MA200 거리         -8.5%  88th          │
│    · 52w 위치           18%    85th          │
│                                              │
│  ⓘ 표본 412 — 정상 산출                       │
└──────────────────────────────────────────────┘
```

### 4.3 새 탭 — '공포 지수' (`/[symbol]/fear-greed`)

CNN F&G 페이지 톤. 분석 탭 카드의 모든 정보를 *더 큰 화면에서 시각적으로 풀어내고*, 시계열·비교 게이지를 추가한다.

```
┌────────────── 공포 지수 페이지 ──────────────────┐
│                                                  │
│  ┌─ Hero ─────────────────────────────────────┐  │
│  │       ╭────────────────────╮               │  │
│  │      │   EXTREME FEAR        │             │  │
│  │      │    18  /  100         │             │  │
│  │       ╰────────────────────╯               │  │
│  │   (반원 게이지, 5단계 컬러 그라데이션)       │  │
│  │                                            │  │
│  │   Now: 18   1주: 32   1개월: 45   1년: 62  │  │
│  │   (CNN의 "Now/1W/1M/1Y" 비교 미니 게이지)  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Flow Group ───────────────────  30 / FEAR ┐  │
│  │  ████████░░░░░░░░░░░░ (수평 바)            │  │
│  │  · Volume z (signed)  -2.1   98th  매도성  │  │
│  │  · Buy/Sell 불균형    -42%   92nd          │  │
│  │  · POC 거리(60bar)    -3.2%  95th          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Trend Group ──────────────────  40 / FEAR ┐  │
│  │  ████████████░░░░░░░░ (수평 바)            │  │
│  │  · MA200 거리         -8.5%  88th          │  │
│  │  · 52w 위치           18%    85th          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Historical 시계열 (1년치 점수) ───────────┐  │
│  │  line chart, 5단계 컬러 영역 그라데이션    │  │
│  │  warm-up 60bar는 빈 영역으로 표시          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ⓘ 신뢰도 정상 (표본 412)                         │
└──────────────────────────────────────────────────┘
```

### 4.4 자연어 해설 — Hybrid (γ)

별도 LLM 호출 없음. 기존 분석 use-case(`buildAnalysisPrompt`)에 fearGreed 컨텍스트(score, label, group breakdown, top contributing factors)를 주입해 종합 분석 자연어의 일부로 자연스럽게 녹인다. 분석 탭에서 분석 결과를 볼 때 "EXTREME FEAR 상태에서…" 같은 해석이 함께 나옴.

## 5. Cross-repo 분담 (SCOPE.md 준수)

| 항목 | 위치 |
|---|---|
| 5-factor raw 산출, percentile, 합성, 라벨링, walk-forward 시계열 | `siglens-core/domain/indicators/fearGreed/` |
| Public API: `computeFearGreedIndex` (snapshot), `computeFearGreedHistory` (walk-forward 시계열) | `siglens-core/src/index.ts` (Tier 1 export) |
| `buildAnalysisPrompt` 확장 — fearGreed 컨텍스트 주입 | `siglens-core/domain/analysis/prompt.ts` |
| 헤더 chip 컴포넌트 (`FearGreedHeaderChip`) | `siglens/src/components/symbol-page/` |
| 분석 탭 카드 (`FearGreedCard`) | `siglens/src/components/symbol-page/` |
| 공포지수 탭 페이지 (Hero / 비교 게이지 / Group / Historical) | `siglens/src/app/[symbol]/fear-greed/` + `siglens/src/components/fear-greed/` |
| `useFearGreed` hook | `siglens/src/components/symbol-page/hooks/` |
| TABS config 항목 추가 | `siglens/src/components/symbol-page/utils/symbolTabsConfig.ts` |
| NewsAugment 삭제 (5 항목, §6 참고) | `siglens` only |

머지 순서: core (계산 + prompt 확장) → core publish → siglens (UI + 라우트 + cleanup).

## 6. NewsAugment 삭제

분석 탭 사이드패널의 NewsAugment를 FearGreedCard로 대체. 정리 대상 (siglens):

```
- src/components/symbol-page/NewsAugment.tsx                     (삭제)
- src/components/symbol-page/hooks/useNewsAugment.ts             (삭제)
- src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx  (삭제)
- src/components/symbol-page/ChartContent.tsx                    (import + render 제거, FearGreedCard로 대체)
- src/components/symbol-page/hooks/useDefaultModelId.ts:7         (NewsAugment 언급 주석 업데이트)
```

## 7. 타입 윤곽

```ts
// siglens-core: domain/indicators/fearGreed/types.ts

export type FearGreedLabel =
  | 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';

export type FearGreedConfidence = 'normal' | 'limited' | 'insufficient';

export interface FearGreedFactor {
  /** 'volume_z' | 'buysell_imbalance' | 'poc_distance' | 'ma200_distance' | 'range_position' */
  key: string;
  /** 화면 라벨 — i18n은 siglens가 책임 */
  rawValue: number;
  /** 0..100, GREED 쪽이 100 */
  percentile: number;
}

export interface FearGreedGroup {
  name: 'Flow' | 'Trend';
  /** 0..100 */
  score: number;
  factors: FearGreedFactor[];
}

export interface FearGreedSnapshot {
  /** 0..100 */
  score: number;
  label: FearGreedLabel;
  groups: FearGreedGroup[];
  confidence: FearGreedConfidence;
  sampleSize: number;
}

export interface FearGreedHistoryPoint {
  /** ISO 날짜(거래일) */
  date: string;
  score: number | null;  // warm-up 구간은 null
  label: FearGreedLabel | null;
}

export interface ComputeFearGreedOptions {
  /** Volume Profile POC 산출 윈도우. default 60 */
  pocWindow?: number;
}

export function computeFearGreedIndex(
  bars: Bar[],
  buySellVolume: BuySellVolumeResult[],
  options?: ComputeFearGreedOptions
): FearGreedSnapshot | null;

export function computeFearGreedHistory(
  bars: Bar[],
  buySellVolume: BuySellVolumeResult[],
  options?: ComputeFearGreedOptions
): FearGreedHistoryPoint[];
```

분석 prompt 컨텍스트 주입은 `buildAnalysisPrompt`의 옵션 파라미터에 `fearGreed?: FearGreedSnapshot`를 추가하고, 시그니처를 단순 확장한다 (기존 호출부와 backward compatible).

## 8. 테스트 전략

### 8.1 core 단위 테스트
- 각 factor raw 산출 정확성 (known input → known output)
- Self-percentile (sorted 분포의 known position)
- 그룹 평균, 합성 (50/50)
- 5단계 컷오프 경계값 (0, 25, 45, 55, 75, 100)
- 신뢰도 분기 (표본 < 10, 10..59, ≥ 60)
- 결측 처리 (BuySellVolume 빈 일자 — Flow factor 제외)
- Walk-forward look-ahead 부재 (t+1 데이터로 t의 점수가 변하지 않음)

### 8.2 siglens 컴포넌트 테스트
- `FearGreedHeaderChip`: snapshot 렌더링, confidence 분기, null 입력 처리
- `FearGreedCard`: 카드 렌더링, factor breakdown 표시
- `useFearGreed`: bars/buySellVolume 입력 → snapshot · history 출력
- `/[symbol]/fear-greed` 페이지 라우팅, SymbolTabs에 새 탭 노출
- NewsAugment 제거 후 ChartContent 정상 동작

### 8.3 통합
- `buildAnalysisPrompt`가 fearGreed 컨텍스트를 받아 자연어에 영향 (prompt snapshot 테스트)

## 9. Caveats / 미해결

- **Volume Profile 도메인 함수 존재 여부**: core에 60-bar window POC 산출 함수가 이미 존재한다고 가정. implementation phase 진입 시 first-step에 확인 필요. 미존재 시 `domain/indicators/volumeProfile/`에 추가하는 작업이 선행된다.
- **chip 컬러**: 5단계 컬러 토큰은 `docs/DESIGN.md`의 차트 컬러 시스템에 맞춰 `frontend-design` skill 단계에서 확정.
- **Hero 게이지 / 시계열 차트 라이브러리**: 기존 lightweight-charts 외에 별도 차트 라이브러리 도입 여부는 `frontend-design` 단계에서 결정. 시계열은 lightweight-charts(또는 Recharts) 재사용 가능, 반원 게이지는 SVG 직접 작성.
- **Tier 정책과의 상호작용**: 공포지수 자체는 분석 use-case가 아니라 *지표 산출*이므로 tier 게이팅 대상이 아니라고 판단. 공포지수 탭 자체는 무료 노출, 분석 prompt에 들어가는 자연어 해석은 기존 분석 tier 정책을 그대로 따름.
- **시계열 차트의 인터랙션 (hover로 그날의 breakdown 보기)**: v1에는 점수 line만, hover-tooltip은 v2.
- **POC 거리·MA200 거리 raw 값 크기**: 강력 반등·하락 종목에서 ±수백%에 이를 수 있다 (validation 실측: INTC에서 POC +151% / MA200 +176% 관측). percentile 정규화 후 점수에는 영향 없으나 UI에는 *raw 값을 그대로* 표시한다 (cap·σ 정규화 안 함). 직관 보강이 필요하면 sparkline 등으로 보완.
- **만성 약세 종목 self-norm paradox**: 1년 이상 약세 사이클이 지속된 종목은 모든 factor의 자기 분포가 음수 영역에 쏠려, 약한 negative raw signal도 percentile 상위로 분류되어 GREED 라벨로 출현할 수 있다 (validation 실측: NVO 케이스 — Volume z +2.68, Buy/Sell −0.77, MA200 −8.25%, 52w 23%인 상태에서 점수 75.2 → EXTREME_GREED 관측). 이는 self-normalization의 *정의된 행동*이며 결함이 아니다 — "이 종목 자기 기준에서 현재가 분포 상위에 있는가"가 점수의 본질. UI 분석 탭 카드의 raw factor breakdown(특히 Trend 그룹의 MA200·52w 위치)으로 사용자가 점수의 원인을 즉시 확인할 수 있게 하는 것이 보강 수단이다. cross-stock baseline 도입은 self-norm 일관성을 깨므로 도입하지 않는다.

## 10. 변경 영향 요약

```
siglens-core
  + domain/indicators/fearGreed/  (신설)
  + index.ts                       (computeFearGreedIndex, computeFearGreedHistory export)
  ~ domain/analysis/prompt.ts      (fearGreed 옵션 추가)
  ~ domain/indicators/volumeProfile/  (60-bar 함수 미존재 시 추가, 확인 필요)

siglens
  + src/app/[symbol]/fear-greed/page.tsx
  + src/components/fear-greed/                 (Hero, 비교 게이지, Group, Historical)
  + src/components/symbol-page/FearGreedHeaderChip.tsx
  + src/components/symbol-page/FearGreedCard.tsx
  + src/components/symbol-page/hooks/useFearGreed.ts
  ~ src/components/symbol-page/SymbolLayoutHeader.tsx     (chip 추가)
  ~ src/components/symbol-page/ChartContent.tsx           (NewsAugment → FearGreedCard)
  ~ src/components/symbol-page/utils/symbolTabsConfig.ts  (TABS에 fear-greed 추가)
  ~ src/components/symbol-page/hooks/useDefaultModelId.ts (주석 업데이트)
  - src/components/symbol-page/NewsAugment.tsx
  - src/components/symbol-page/hooks/useNewsAugment.ts
  - src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx
```

## 11. 요약 의사결정 로그

| 결정 | 채택 |
|---|---|
| 측정 단위 | 티커별 (per-stock) |
| 정규화 | Self-normalization (자기 분포 percentile) |
| Lookback | Adaptive, min 없음 (있는 만큼). 표본 < 60은 신뢰도 제한, < 10은 산출 보류 |
| Timeframe | 일봉 고정 |
| Factor 구성 | 5-factor (Flow 3 + Trend 2) |
| 합성 | 그룹 50/50 (Flow 50% + Trend 50%) |
| 컷오프 | CNN F&G 표준 (0-25 / 25-45 / 45-55 / 55-75 / 75-100) |
| 데이터 fetch | 기존 일봉 500-bar 재사용, 추가 fetch 없음 |
| 분포 갱신 | 요청 시 ad-hoc, 캐시 미신설 |
| POC 윈도우 | 60 bar (~분기) |
| Volume z 부호 | Signed (z × sign(daily_return)) |
| Historical 산출 | Walk-forward (warm-up 60 bar) |
| UI | (A) 헤더 chip + (C) 분석 탭 카드 + 새 탭 '공포 지수' |
| 자연어 해석 | Hybrid (γ) — 카드는 deterministic, 자연어는 buildAnalysisPrompt 컨텍스트 주입 |
| 정리 | NewsAugment 5조각 삭제 |

## 12. Implementation Guidelines

본 디자인을 따라 구현할 때 반드시 지킬 운영 규칙. `writing-plans`로 implementation plan을 작성할 때 plan 자체에도 동일 규칙이 반영되어야 한다.

### 12.1 작업 격리 — Git Worktree

implementation은 **별도 git worktree에서 진행**한다. 메인 브랜치(메인 폴더, `siglens/master`)에는 어떤 변경도 일어나지 않도록 한다.

- worktree 경로: `../siglens-fear-greed/` (siglens 옆)
- 브랜치 명: `feat/per-stock-fear-greed-index`
- siglens-core 변경분도 별도 worktree에서 작업 (core repo 위치 옆)
- 머지 순서: core PR → core publish → siglens PR
- 메인 폴더는 다른 작업과 병행 가능

### 12.2 Phase별 Skill 사용 (CLAUDE.md "Skill Usage Rules" 강제)

다음 매핑을 implementation plan에 명시하고, 각 phase 진입 시 해당 skill을 *코드 작성 전에 먼저 invoke*한다.

| Phase | 작업 영역 | 호출 순서 |
|---|---|---|
| Core 알고리즘 (`siglens-core/domain/indicators/fearGreed/`) | Pure 함수, 도메인 타입, percentile, walk-forward 산출, 5-factor 합성 | `typescript-advanced-types` → `typescript-expert` |
| Core 분석 prompt 확장 (`siglens-core/domain/analysis/prompt.ts`) | `buildAnalysisPrompt` 시그니처 확장, fearGreed 컨텍스트 주입 | `typescript-expert` |
| Hook & 데이터 통합 (siglens) | `useFearGreed`, useBars 결과 재사용, React Query 통합 | `vercel-react-best-practices` → `next-cache-components` |
| 새 라우트 페이지 `/[symbol]/fear-greed` | RSC layout, generateMetadata, SEO | `vercel-react-best-practices` → `next-cache-components` → `seo-audit` |
| UI 컴포넌트 (`FearGreedHeaderChip`, `FearGreedCard`, Hero 반원 게이지, 비교 미니 게이지, Group 수평 바, Historical 시계열 차트) | 시각 디자인, 접근성, SEO | `frontend-design` → `web-design-guidelines` → `seo-audit` |
| `SymbolLayoutHeader` chip 통합, `ChartContent` NewsAugment 교체, TABS config 갱신 | 기존 컴포넌트 수정 | `vercel-react-best-practices` |

누락 시 review-agent가 detect한다. plan 작성 시 각 단계 노트에 invoke할 skill을 명시한다.
