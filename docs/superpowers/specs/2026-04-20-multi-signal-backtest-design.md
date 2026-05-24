# 멀티-시그널 백테스트 엔트리 탐지 설계

**날짜:** 2026-04-20
**상태:** 설계 승인 대기
**관련 스펙:** [2026-04-20-backtesting-page-design.md](./2026-04-20-backtesting-page-design.md)

---

## 1. 목적

`/backtesting` 페이지에 목업(`page-layout-v4.html`)이 약속한 "티커당 여러 날짜 × 다양한 지표 조합 × 약 93개 케이스"를 실제로 생성한다.

현재 `scripts/backtests/generate-backtest.ts`의 `detectBuySignals()`는 RSI 30 상향 돌파만 감지해 케이스 다양성과 수량이 모두 부족하다 (`data.json`은 빈 배열). AI 응답의 `trend` 필드만 활용하고 있어 `AnalysisResponse`의 `actionRecommendation`·`priceTargets` 정보가 사장된다.

본 설계는 다음을 달성한다:
1. 13종 보조지표 기반 시그널 탐지 확장 (현재 4개 bullish confirmed → 17개)
2. 티커당 여러 날짜의 다양한 진입 케이스 생성 (confluence 기반)
3. AI `actionRecommendation.stopLoss`/`takeProfitPrices` 기반 현실적 exit 시뮬레이션
4. AI `entryRecommendation` 기반 "AI 의사결정 정확도" + `priceTargets` 기반 "AI 목표 도달률" 2차원 집계

---

## 2. 범위

### In Scope
- `src/domain/signals/confirmed.ts`에 bullish 탐지기 9개 신규 추가
- `src/domain/backtest/exit.ts` 신규 — SL/TP bar-by-bar 시뮬레이션 순수 함수
- `src/domain/backtest/tags.ts` 신규 — `Signal.type` → 한글 라벨 맵
- `src/domain/types.ts` — `BacktestCase`·`BacktestMeta` 필드 확장
- `scripts/backtests/generate-backtest.ts` — sweep 루프 전면 교체
- 단위 테스트 (신규 탐지기, exit 시뮬레이션, 태그 맵)

### Out of Scope
- Bearish(sell) 시그널 탐지기 및 short 백테스트
- UI 컴포넌트(`BacktestCaseCard`·`BacktestHero`)의 `aiResult: 'neutral'` 대응 — 별도 후속 작업
- `src/domain/backtest/validate.ts` 기존 유지 (스키마 변경 반영은 후속)
- `calculateIndicators`의 per-bar 재계산 최적화 (알려진 기술부채로 기록)

---

## 3. 스키마 변경 (`src/domain/types.ts`)

### BacktestCase
```ts
export type BacktestSignalResult = 'win' | 'loss';
export type BacktestAiResult = 'win' | 'loss' | 'neutral';
export type BacktestExitReason = 'take_profit' | 'stop_loss' | 'time';

export interface BacktestCase {
    ticker: string;
    entryDate: string;            // 'YYYY-MM-DD' (FMP bar.date 직접 사용)
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    holdingDays: number;
    returnPct: number;
    signalType: 'buy';            // 본 설계는 buy-only

    result: BacktestSignalResult; // 실제 가격 결과 기반 (returnPct ≥ 0 → win)
    exitReason: BacktestExitReason;

    aiResult: BacktestAiResult;   // 'neutral' = AI가 entryRecommendation='wait' 반환
    aiTrendHit: boolean;          // AI 'bullish' 예측 + priceTargets.bullish[0] 도달

    aiAnalysis: {
        summary: string;          // AnalysisResponse.summary 앞 150자
        tags: string[];           // 터진 Signal.type → 한글 라벨 (최대 3개)
    };
}
```

### BacktestMeta
```ts
export interface BacktestMeta {
    period: string;               // "2025.04 – 2026.04"
    totalCases: number;
    winRate: number;              // (result='win') / totalCases × 100
    aiWinRate: number;            // (aiResult='win') / (win + loss) × 100  ← neutral 분모 제외
    aiTrendHitRate: number;       // aiTrendHit=true / totalCases × 100
    tickerCount: number;
}
```

### 스키마 변경 영향
- 기존 `exitReason: 'signal' | 'stop_loss'` → 3분법으로 확장 → `validateBacktestData` 업데이트 필요(후속)
- 기존 `aiResult: 'win' | 'loss'` → `'neutral'` 추가 → UI 컴포넌트의 뱃지·색상 처리 후속 필요
- `aiTrendHit`·`aiTrendHitRate` 신규 — UI에서 표기 여부는 후속 결정

---

## 4. 신규 시그널 탐지기 (9개)

`src/domain/signals/confirmed.ts`에 추가. 모두 `(bars, indicators) => Signal | null` 시그니처, `direction: 'bullish'`, `phase: 'confirmed'`.

| 함수명 | `Signal.type` | 규칙 |
|---|---|---|
| `detectSupertrendBullishFlip` | `supertrend_bullish_flip` | lookback 3 bar 내 direction이 bearish → bullish 전환 |
| `detectIchimokuCloudBreakout` | `ichimoku_cloud_breakout` | 직전 bar close ≤ kumoUpper, 최신 close > kumoUpper |
| `detectCciBullishCross` | `cci_bullish_cross` | CCI가 -100 또는 +100 상향 돌파 (lookback 3) |
| `detectDmiBullishCross` | `dmi_bullish_cross` | +DI가 -DI 상향 돌파 AND ADX ≥ 20 (lookback 3) |
| `detectCmfBullishFlip` | `cmf_bullish_flip` | CMF가 0 상향 돌파 (lookback 3) |
| `detectMfiOversoldBounce` | `mfi_oversold_bounce` | 직전 bar MFI < 20, 최신 bar MFI ≥ 20 |
| `detectParabolicSarFlip` | `parabolic_sar_flip` | SAR 점이 close 위 → 아래로 전환 (lookback 3) |
| `detectKeltnerUpperBreakout` | `keltner_upper_breakout` | 직전 close ≤ Keltner upper, 최신 close > Keltner upper |
| `detectSqueezeMomentumBullish` | `squeeze_momentum_bullish` | 직전 histogram ≤ 0, 최신 histogram > 0 |

모두 `src/domain/signals/confirmed.ts`의 기존 헬퍼 재활용:
- **Cross 계열 (Supertrend/CCI/DMI/CMF/Parabolic SAR/Squeeze)**: `findCross`/`findMacdCross` 유사 패턴
- **Breakout 계열 (Ichimoku/Keltner)**: `detectBollingerUpperBreakout` 유사 패턴
- **Bounce 계열 (MFI)**: `detectBollingerLowerBounce` 유사 패턴

`src/domain/signals/index.ts`의 `DETECTORS` 배열에 9개 추가 등록.

### Lookback 상수

기존 `CROSS_LOOKBACK_BARS = 3` 재활용 (Supertrend·CCI·DMI·CMF·Parabolic SAR·Squeeze Momentum). Breakout/Bounce은 직전 bar 비교만 필요하므로 상수 불필요.

### Bearish 카운터파트

본 설계에서 **생성하지 않음** (buy-only 방침). 추후 short 백테스트 기능 도입 시 동일 패턴으로 확장.

---

## 5. Sweep 루프 (`scripts/backtests/generate-backtest.ts`)

### 5.1 상수

```ts
const FROM_DATE_FETCH = '2024-09-01';     // 지표 warmup 확보
const DISPLAY_START_DATE = '2025-04-01';  // spec의 meta.period 시작일
const TO_DATE = '2026-04-20';
const MIN_BARS = 120;                     // SQUEEZE_LOOKBACK_BARS와 동일 — BB squeeze 성숙 시점
const MIN_CONFLUENCE = 2;                 // 동시 활성 bullish 최소 개수
const HOLD_DAYS = 10;                     // 쿨다운 기간 + time exit fallback
const MAX_SIGNALS_PER_TICKER = 10;        // 목업과 일치
const MAX_TAGS_PER_CASE = 3;              // 목업과 일치
```

### 5.2 진입 후보 탐지

```ts
interface EntryCandidate {
    idx: number;
    entryDate: string;
    entryPrice: number;
    signalTypes: string[];  // 최대 MAX_TAGS_PER_CASE
}

function findEntryCandidates(
    bars: Bar[],
    fmpBars: FmpBar[]
): EntryCandidate[] {
    const candidates: EntryCandidate[] = [];
    let cooldownUntil = -1;

    // ── 시딩: MIN_BARS-1 시점의 bullish 상태 ──
    // 이 시딩이 없으면 루프 첫 반복에서 모든 활성 시그널이 "fresh"로 오탐지됨
    const seedPrefix = bars.slice(0, MIN_BARS);
    let lastBullishTypes = new Set(
        detectSignals(seedPrefix, calculateIndicators(seedPrefix))
            .filter(s => s.direction === 'bullish')
            .map(s => s.type)
    );

    for (let i = MIN_BARS; i < bars.length - HOLD_DAYS; i++) {
        const prefix = bars.slice(0, i + 1);
        const bullishTypes = new Set(
            detectSignals(prefix, calculateIndicators(prefix))
                .filter(s => s.direction === 'bullish')
                .map(s => s.type)
        );

        // "오늘 처음 등장한 type" = 전환 이벤트
        // 이벤트형 (cross)·상태형 (oversold/bounce) 탐지기에 모두 작동
        const fresh = [...bullishTypes].filter(t => !lastBullishTypes.has(t));

        const entryDate = fmpBars[i].date;
        const inDisplayRange = entryDate >= DISPLAY_START_DATE;

        // 조건: "현재 활성 ≥2 AND 최소 1개는 오늘 새로 발생"
        // "fresh ≥ 2"는 너무 엄격 — 누적 컨텍스트 + 트리거 1개 패턴이 현실적
        if (
            inDisplayRange &&
            i > cooldownUntil &&
            bullishTypes.size >= MIN_CONFLUENCE &&
            fresh.length >= 1
        ) {
            candidates.push({
                idx: i,
                entryDate,
                entryPrice: fmpBars[i].close,
                signalTypes: [...bullishTypes].slice(0, MAX_TAGS_PER_CASE),
            });
            cooldownUntil = i + HOLD_DAYS;
        }

        // 전환 검출 상태는 pre-display 구간에서도 갱신 유지
        lastBullishTypes = bullishTypes;
    }

    return candidates.slice(-MAX_SIGNALS_PER_TICKER);
}
```

### 5.3 루프 설계 근거

- **Pre-display 상태 유지**: `lastBullishTypes`는 display 범위 밖에서도 업데이트. 그래야 display 시작일 바로 전 transition이 정확히 포착됨.
- **Cooldown은 pre-display 구간에서 설정 안 함**: 실제 유저는 2025-04-01에 Siglens를 시작하므로 그 전 시그널에 "보유 중"인 상태가 아님.
- **Tags = 현재 활성 bullish 전체** (fresh가 아닌 `bullishTypes`): 목업 케이스의 태그는 진입 시점 전체 맥락을 보여줌.

---

## 6. Exit 시뮬레이션 (`src/domain/backtest/exit.ts`)

### 6.1 인터페이스

```ts
export interface ExitSimulationInput {
    bars: Bar[];
    entryIdx: number;
    entryPrice: number;
    stopLoss?: number;     // undefined면 SL 체크 안 함
    takeProfit?: number;   // undefined면 TP 체크 안 함
    maxHoldDays: number;
}

export interface ExitSimulationResult {
    exitIdx: number;
    exitPrice: number;
    exitReason: BacktestExitReason;
    holdingDays: number;
    returnPct: number;
}

export function simulateExit(input: ExitSimulationInput): ExitSimulationResult;
```

### 6.2 구현 규칙

```ts
export function simulateExit(input: ExitSimulationInput): ExitSimulationResult {
    const { bars, entryIdx, entryPrice, stopLoss, takeProfit, maxHoldDays } = input;
    const maxIdx = Math.min(entryIdx + maxHoldDays, bars.length - 1);

    for (let i = entryIdx + 1; i <= maxIdx; i++) {
        const bar = bars[i];
        const hitSL = stopLoss !== undefined && bar.low <= stopLoss;
        const hitTP = takeProfit !== undefined && bar.high >= takeProfit;

        // 동일 bar 내 SL·TP 동시 발동 시 보수적으로 SL 우선
        // (실제 체결 시 intraday 순서는 알 수 없으므로 최악 가정이 공정)
        if (hitSL) return build(i, stopLoss!, 'stop_loss', entryIdx, entryPrice);
        if (hitTP) return build(i, takeProfit!, 'take_profit', entryIdx, entryPrice);
    }

    // time exit: 보유 만기 bar의 close
    const exitBar = bars[maxIdx];
    return build(maxIdx, exitBar.close, 'time', entryIdx, entryPrice);
}
```

`returnPct`:
```ts
returnPct = ((exitPrice - entryPrice) / entryPrice) * 100
```

### 6.3 엣지 케이스

- 엔트리 bar 자체에서는 TP/SL 체크 안 함 (entry at close → 다음 bar부터 관찰)
- `bars.length - 1 - entryIdx < maxHoldDays`면 가용 마지막 bar에서 time exit (sweep 루프의 `i < bars.length - HOLD_DAYS` 가드로 방지됨)
- `stopLoss === undefined && takeProfit === undefined`면 항상 time exit

---

## 7. AI 통합 + 결과 판정

### 7.1 AI 호출 래퍼

```ts
interface AiAnalysisForBacktest {
    trend: Trend;
    summary: string;
    entryRecommendation: EntryRecommendation;
    stopLoss?: number;
    takeProfit?: number;
    bullishTargets: number[];
}

async function runAiAnalysis(
    ticker: string,
    bars: Bar[],
    entryIdx: number
): Promise<AiAnalysisForBacktest> {
    const contextBars = bars.slice(
        Math.max(0, entryIdx - CONTEXT_BARS + 1),
        entryIdx + 1
    );
    const indicators = calculateIndicators(contextBars);
    const prompt = buildAnalysisPrompt(ticker, contextBars, indicators, [], '1Day');
    const text = await callGeminiWithRetryAfter(prompt);
    const raw = parseJsonResponse<RawAnalysisResponse>(text, 'analysis');
    const result = enrichAnalysisWithConfidence(raw, []);

    // entryRecommendation 방어 — LLM이 이상값 반환 시 'wait'로 폴백
    const validRecs: EntryRecommendation[] = ['enter', 'wait', 'avoid'];
    const rawRec = result.actionRecommendation?.entryRecommendation;
    const entryRecommendation: EntryRecommendation = validRecs.includes(
        rawRec as EntryRecommendation
    )
        ? (rawRec as EntryRecommendation)
        : 'wait';

    return {
        trend: result.trend,
        summary: (result.summary ?? '').slice(0, 150),
        entryRecommendation,
        stopLoss: result.actionRecommendation?.stopLoss,
        takeProfit: result.actionRecommendation?.takeProfitPrices?.[0],
        bullishTargets:
            result.priceTargets?.bullish?.targets.map(t => t.price) ?? [],
    };
}
```

### 7.2 SL/TP 무결성 검증

LLM이 일관되지 않은 가격(stopLoss ≥ entryPrice, takeProfit ≤ entryPrice)을 반환할 수 있음. 무효 값은 `undefined`로 버려 time exit fallback 유도.

```ts
const safeStopLoss =
    ai.stopLoss !== undefined && ai.stopLoss < candidate.entryPrice
        ? ai.stopLoss
        : undefined;
const safeTakeProfit =
    ai.takeProfit !== undefined && ai.takeProfit > candidate.entryPrice
        ? ai.takeProfit
        : undefined;
```

### 7.3 결과 판정 로직

```ts
function computeAiResult(
    entryRec: EntryRecommendation,
    actualReturnPct: number
): BacktestAiResult {
    if (entryRec === 'wait') return 'neutral';
    if (entryRec === 'enter' && actualReturnPct > 0) return 'win';
    if (entryRec === 'avoid' && actualReturnPct < 0) return 'win';
    return 'loss';
}

function computeAiTrendHit(
    trend: Trend,
    bullishTargets: number[],
    bars: Bar[],
    entryIdx: number,
    exitIdx: number
): boolean {
    // "AI가 bullish 시나리오 목표가를 실제로 맞혔는가"
    // bearish/neutral trend 케이스는 bullish target 제시 자체를 안 하므로 false
    if (trend !== 'bullish' || bullishTargets.length === 0) return false;
    const firstTarget = bullishTargets[0];
    return bars
        .slice(entryIdx + 1, exitIdx + 1)
        .some(b => b.high >= firstTarget);
}
```

### 7.4 메인 루프 통합

```ts
for (const candidate of candidates) {
    const ai = await runAiAnalysis(ticker, bars, candidate.idx);

    const safeStopLoss = /* 7.2 검증 */;
    const safeTakeProfit = /* 7.2 검증 */;

    const exit = simulateExit({
        bars,
        entryIdx: candidate.idx,
        entryPrice: candidate.entryPrice,
        stopLoss: safeStopLoss,
        takeProfit: safeTakeProfit,
        maxHoldDays: HOLD_DAYS,
    });

    const result: BacktestSignalResult = exit.returnPct >= 0 ? 'win' : 'loss';
    const aiResult = computeAiResult(ai.entryRecommendation, exit.returnPct);
    const aiTrendHit = computeAiTrendHit(
        ai.trend,
        ai.bullishTargets,
        bars,
        candidate.idx,
        exit.exitIdx
    );

    allCases.push({
        ticker,
        entryDate: candidate.entryDate,
        entryPrice: candidate.entryPrice,
        exitDate: fmpBars[exit.exitIdx].date,
        exitPrice: exit.exitPrice,
        holdingDays: exit.holdingDays,
        returnPct: Number(exit.returnPct.toFixed(2)),
        signalType: 'buy',
        result,
        exitReason: exit.exitReason,
        aiResult,
        aiTrendHit,
        aiAnalysis: {
            summary: ai.summary,
            tags: candidate.signalTypes.map(signalTypeToTagLabel),
        },
    });

    await sleep(GEMINI_SLEEP_MS);
}
```

### 7.5 메타 집계

```ts
const total = sortedCases.length;
const wins = sortedCases.filter(c => c.result === 'win').length;
const aiDecisive = sortedCases.filter(c => c.aiResult !== 'neutral');
const aiWins = aiDecisive.filter(c => c.aiResult === 'win').length;
const aiTrendHits = sortedCases.filter(c => c.aiTrendHit).length;

const meta: BacktestMeta = {
    period: '2025.04 – 2026.04',
    totalCases: total,
    winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
    aiWinRate:
        aiDecisive.length > 0
            ? Number(((aiWins / aiDecisive.length) * 100).toFixed(1))
            : 0,
    aiTrendHitRate:
        total > 0 ? Number(((aiTrendHits / total) * 100).toFixed(1)) : 0,
    tickerCount: TICKERS.length,
};
```

---

## 8. 태그 라벨 맵 (`src/domain/backtest/tags.ts`)

```ts
const TAG_LABEL_MAP: Record<string, string> = {
    // 기존 confirmed bullish (8개)
    rsi_oversold: 'RSI 과매도 반등',
    golden_cross: 'EMA 골든크로스',
    macd_bullish_cross: 'MACD 골든크로스',
    bollinger_lower_bounce: 'BB 하단 반등',
    rsi_bullish_divergence: 'RSI 강세 다이버전스',
    macd_histogram_bullish_convergence: 'MACD 히스토그램 강세 수렴',
    bollinger_squeeze_bullish: 'BB 수축 강세',
    support_proximity_bullish: '지지선 근접',

    // 신규 bullish (9개)
    supertrend_bullish_flip: 'Supertrend 전환',
    ichimoku_cloud_breakout: 'Ichimoku 구름 돌파',
    cci_bullish_cross: 'CCI 100 돌파',
    dmi_bullish_cross: 'DMI 골든크로스',
    cmf_bullish_flip: 'CMF 매집 전환',
    mfi_oversold_bounce: 'MFI 과매도 반등',
    parabolic_sar_flip: 'Parabolic SAR 전환',
    keltner_upper_breakout: 'Keltner 상단 돌파',
    squeeze_momentum_bullish: 'Squeeze 양전환',
};

export function signalTypeToTagLabel(type: string): string {
    return TAG_LABEL_MAP[type] ?? type;
}
```

`Signal['type']`은 string literal union이 아닌 `string` — 타입 추가 시 맵 수동 업데이트 필요. 단위 테스트로 모든 `Signal.type` 값이 매핑되어 있는지 검증한다.

---

## 9. 테스트 전략

### 9.1 신규 탐지기 단위 테스트
- `src/__tests__/domain/signals/confirmed.test.ts` 확장 (9개 추가)
- 각 탐지기별 fixture bars로 fire/no-fire 케이스 검증
- `lookback` 경계 검증 (정확히 3 bar 이전 cross는 포함, 4 bar 이전은 제외)

### 9.2 Exit 시뮬레이션 테스트
`src/__tests__/domain/backtest/exit.test.ts` 신규, 시나리오:
- TP hit 먼저 → `exitReason='take_profit'`, 정확한 `holdingDays` 반환
- SL hit 먼저 → `exitReason='stop_loss'`
- 동일 bar SL+TP 충돌 → SL 우선 반환 검증
- SL·TP 모두 미발동 → `exitReason='time'`, 마지막 bar close에서 exit
- `stopLoss`/`takeProfit` 모두 undefined → time exit
- `maxHoldDays`가 `bars.length - entryIdx`보다 크면 가용 마지막 bar에서 exit

### 9.3 태그 맵 테스트
`src/__tests__/domain/backtest/tags.test.ts` 신규:
- `DETECTORS` 배열을 런타임 import해 모든 detector 호출 결과의 `type` 값이 `TAG_LABEL_MAP` 키에 존재하는지 검증 (완전성 테스트)
- 누락 시 CI에서 실패 → 신규 탐지기 추가 시 라벨 누락 방지

### 9.4 통합 검증 (수동)
스크립트 실행 후 생성된 `data.json` 샘플 검사:
- `cases.length >= 30`
- 태그 종류 다양성 (최소 5개 이상의 서로 다른 라벨 등장)
- `result='win'` 비율이 60~80% 범위 (spec의 설계 의도와 일치)
- `aiResult` 3종 (win/loss/neutral) 모두 존재
- `exitReason` 3종 (take_profit/stop_loss/time) 모두 존재

---

## 10. 알려진 제약 & 트레이드오프

### 10.1 Set-based fresh 검출의 lookback 경계 엣지 케이스
동일 type이 cross lookback 범위 내에서 재발생 시(예: golden_cross가 bar 100과 bar 103에 연속 발생) 두 번째 이벤트가 "fresh"로 검출되지 않음. Cooldown(10 bars)이 이중 방어하므로 실용상 무관.

### 10.2 Cooldown은 계획 HOLD_DAYS 기준 (조기 청산 무관)
SL/TP가 진입 3일 후 발동해도 다음 진입은 여전히 HOLD_DAYS(10) 이후. 리스크 관리 디시플린을 대변하는 의도적 단순화.

### 10.3 Pre-display 구간에서 active였던 신호의 연속성 단절 가능성
2024년 말 active였던 시그널이 2025-04-01 display 시작 시점에도 여전히 active면 "전환 아님"으로 처리. 결과적으로 display 시작 직후 첫 몇 주의 신호 밀도가 실제보다 낮을 수 있음. Fetch를 더 앞당겨도 동일 논리적 경계 문제라 수용.

### 10.4 calculateIndicators per-bar 재계산 — O(N²) 추정
sweep마다 prefix 전체에 지표 재계산. N=400 bars × 280 iterations × 25 indicators 수준 (10 tickers 합쳐 ~수 분). 배치 스크립트 1회 수동 실행이라 수용 가능. 실측 5분 초과 시 `sliceIndicators` 헬퍼 도입해 리팩토링.

### 10.5 LLM 응답 무결성은 검증 레이어에 의존
`actionRecommendation.stopLoss`·`takeProfitPrices`의 값 범위 검증은 `enrichAnalysisWithConfidence`와 본 스크립트의 `safeStopLoss`·`safeTakeProfit` 가드에 의존. 극단적 이상값(예: `stopLoss=0`)은 `safeStopLoss < entryPrice` 조건을 통과할 수 있음 — 명시적 범위 검증은 후속.

### 10.6 UI 후속 작업 필요
- `aiResult='neutral'` 케이스의 컴포넌트 표기 (뱃지·색상)
- `aiTrendHitRate` 메타 카드 추가 여부 결정
- `exitReason='take_profit'`과 `'signal'` 구분 표시

본 설계는 데이터 생성 파이프라인만 다루며 UI는 후속 작업에서 처리한다.

---

## 11. 파일 맵

| 파일 | 동작 |
|---|---|
| `src/domain/types.ts` | `BacktestCase`·`BacktestMeta` 필드 확장, `BacktestAiResult`·`BacktestExitReason` 타입 추가 |
| `src/domain/signals/confirmed.ts` | 9개 bullish 탐지기 추가 |
| `src/domain/signals/index.ts` | `DETECTORS`에 9개 등록 |
| `src/domain/backtest/exit.ts` | 신규 — `simulateExit` |
| `src/domain/backtest/tags.ts` | 신규 — `signalTypeToTagLabel` |
| `src/__tests__/domain/signals/confirmed.test.ts` | 9개 탐지기 테스트 |
| `src/__tests__/domain/backtest/exit.test.ts` | 신규 — 6 시나리오 |
| `src/__tests__/domain/backtest/tags.test.ts` | 신규 — 맵 완전성 |
| `scripts/backtests/generate-backtest.ts` | `detectBuySignals`·`calcRsiSimple` 제거, sweep 루프 교체, AI 통합 확장 |
| `src/app/backtesting/data.json` | 스크립트 실행 결과물로 재생성 |

---

## 12. 실행 예상치

- 티커 10개 × 평균 ~10 후보 × confluence=2 필터링 후 ≈ 60~100 케이스 (목표 93)
- AI 호출 ~100회 × 5s sleep = 8분
- 429 재시도 여유 포함 총 실행 ~15분
- `wait` 제외율 20~30% 가정 시 최종 dataset 50~80개
- 50개 미만이면 `MIN_CONFLUENCE=1` + `entryRecommendation='enter'` 게이트로 fallback 조정 (스크립트 재실행)
