# Multi-Signal Backtest Entry Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/backtests/generate-backtest.ts`의 RSI 단일 시그널 기반 케이스 생성을 13종 보조지표 기반 confluence 탐지 + AI SL/TP exit 시뮬레이션 + 2차원 AI 정확도 집계 구조로 교체해 목업이 약속한 "티커당 여러 날짜 × 다양한 지표 조합" 백테스트 데이터셋을 실제로 생성한다.

**Architecture:** `src/domain/signals/confirmed.ts`에 bullish 탐지기 9개 (Supertrend/Ichimoku/CCI/DMI/CMF/MFI/Parabolic SAR/Keltner/Squeeze Momentum) 추가 → `src/domain/signals/index.ts`의 `DETECTORS` 배열에 등록 → `src/domain/backtest/exit.ts`에 SL/TP bar-by-bar 시뮬레이션 순수 함수 신규 → `src/domain/backtest/tags.ts`에 `Signal.type → 한글 라벨` 맵 신규 → `scripts/backtests/generate-backtest.ts`가 sweep 루프에서 `detectSignals` 재사용해 confluence 기반 후보 생성 후 AI 분석·exit 시뮬·2차원 판정.

**Tech Stack:** TypeScript 5, Jest (기존 테스트 프레임워크), Google Gemini API (기존 재사용), FMP API (기존 재사용), 기존 `src/domain/indicators/` 순수 함수 재활용

**Spec:** `docs/superpowers/specs/2026-04-20-multi-signal-backtest-design.md`

---

## 테스트 파일 편집 관례

Task 4~12의 각 탐지기 테스트 추가 시 다음 배치를 지킨다:
- `import { ... } from '@/domain/signals/confirmed'` 구문 및 `import type { ... } from '@/domain/types'` 구문은 **파일 상단의 기존 import 블록에 병합** (한 파일에 여러 개의 top-level import 블록을 두는 것도 TypeScript에서 허용되지만 ESLint 규칙에 위배될 수 있음).
- `function withXxx(values) { ... }`·`function barsWithClose(...)` 등 helper 함수 선언과 `describe(...)` 블록은 **파일 끝에 append**.
- 처음 helper(`barsWithClose` 등)를 도입하는 태스크 이후로는 재선언 불필요 — 다음 태스크에서 같은 이름 helper 발견 시 재선언 건너뜀.

---

## File Map

| 파일 | 동작 |
|---|---|
| `src/domain/types.ts` | `BacktestAiResult`·`BacktestExitReason` 타입 추가, `BacktestCase`·`BacktestMeta` 확장 |
| `src/domain/signals/constants.ts` | 신규 탐지기용 임계값 추가 (DMI ADX·CCI 레벨·MFI oversold 등) |
| `src/domain/signals/confirmed.ts` | 9개 bullish 탐지기 추가, `findCross` export |
| `src/domain/signals/index.ts` | `DETECTORS` 배열에 9개 탐지기 등록 |
| `src/domain/backtest/exit.ts` | 신규 — `simulateExit` 순수 함수 |
| `src/domain/backtest/tags.ts` | 신규 — `signalTypeToTagLabel` 매핑 함수 |
| `src/__tests__/domain/signals/confirmed.test.ts` | 신규 9개 탐지기 테스트 |
| `src/__tests__/domain/backtest/exit.test.ts` | 신규 — 6 시나리오 |
| `src/__tests__/domain/backtest/tags.test.ts` | 신규 — 맵 완전성 테스트 |
| `scripts/backtests/generate-backtest.ts` | sweep 루프·AI 통합 전면 교체 |
| `src/app/backtesting/data.json` | 스크립트 실행 결과물로 재생성 |

---

## Task 1: 도메인 타입 확장

**Files:**
- Modify: `src/domain/types.ts` — 기존 `BacktestCase`·`BacktestMeta` 인터페이스 찾아 확장

- [ ] **Step 1: 기존 BacktestCase·BacktestMeta 위치 확인**

```bash
grep -n "BacktestCase\|BacktestMeta\|BacktestSignalResult" src/domain/types.ts
```

Expected: `BacktestSignalResult`, `BacktestCase`, `BacktestMeta`, `BacktestData` 선언 위치 출력

- [ ] **Step 2: 기존 블록을 아래 블록으로 교체**

`src/domain/types.ts`의 기존 `// ─── Backtesting ───` 섹션 전체를 다음으로 교체:

```typescript
// ─── Backtesting ──────────────────────────────────────────────────────────────

export type BacktestSignalResult = 'win' | 'loss';
export type BacktestAiResult = 'win' | 'loss' | 'neutral';
export type BacktestExitReason = 'take_profit' | 'stop_loss' | 'time';

export interface BacktestCase {
    ticker: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    holdingDays: number;
    returnPct: number;
    signalType: 'buy';
    result: BacktestSignalResult;
    exitReason: BacktestExitReason;
    aiResult: BacktestAiResult;
    aiTrendHit: boolean;
    aiAnalysis: {
        summary: string;
        tags: string[];
    };
}

export interface BacktestMeta {
    period: string;
    totalCases: number;
    winRate: number;
    aiWinRate: number;
    aiTrendHitRate: number;
    tickerCount: number;
}

export interface BacktestData {
    meta: BacktestMeta;
    cases: BacktestCase[];
}
```

- [ ] **Step 3: 린트·빌드 통과 확인**

```bash
yarn lint && npx tsc --noEmit
```

Expected: 에러 없음. 단, 기존 `src/domain/backtest/validate.ts`에서 `BacktestCase` 타입을 참조한다면 타입 오류 발생 가능 — 그 경우 validate.ts의 `signalType` 검증 로직을 buy-only 맞춰 업데이트(validate 관련 수정은 후속 태스크에서 처리, 이번 태스크에서는 타입 선언만)

- [ ] **Step 4: 커밋**

```bash
git add src/domain/types.ts
git commit -m "feat: extend BacktestCase with aiResult=neutral and exit reason enum"
```

---

## Task 2: Signal 상수 추가

**Files:**
- Modify: `src/domain/signals/constants.ts`

- [ ] **Step 1: 상수 추가**

`src/domain/signals/constants.ts` 파일 끝에 추가:

```typescript
// ─── Bullish detector thresholds (buy-only backtest) ─────────────────────────

export const DMI_ADX_TREND_THRESHOLD = 20;       // DMI 골든크로스 성립을 위한 최소 ADX
export const CCI_OVERSOLD_CROSS_LEVEL = -100;    // CCI -100 상향 돌파
export const CCI_BULLISH_CROSS_LEVEL = 100;      // CCI +100 상향 돌파
export const CMF_BULLISH_CROSS_LEVEL = 0;        // CMF 0 상향 (매집 전환)
export const MFI_OVERSOLD_LEVEL = 20;            // MFI 20 상향 돌파 (과매도 반등)
export const SQUEEZE_MOMENTUM_ZERO_CROSS = 0;    // 히스토그램 0 상향 돌파
```

- [ ] **Step 2: 린트 확인**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/signals/constants.ts
git commit -m "feat(signals): add thresholds for new bullish detectors"
```

---

## Task 3: `findCross` export

**Files:**
- Modify: `src/domain/signals/confirmed.ts`

신규 탐지기들이 재사용할 수 있도록 기존 private helper를 export.

- [ ] **Step 1: `findCross` 함수를 찾아 export 추가**

`src/domain/signals/confirmed.ts`에서 `function findCross(` 를 `export function findCross(` 로 변경.
또한 `type CrossDirection` 을 `export type CrossDirection` 으로 변경.

```typescript
// Before:
type CrossDirection = 'up' | 'down';

function findCross(...) { ... }

// After:
export type CrossDirection = 'up' | 'down';

export function findCross(...) { ... }
```

- [ ] **Step 2: 린트 확인**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/signals/confirmed.ts
git commit -m "refactor(signals): export findCross helper for new detectors"
```

---

## Task 4: Supertrend bullish flip 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/signals/confirmed.test.ts` 끝에 추가:

```typescript
// ─── detectSupertrendBullishFlip ──────────────────────────────────────────────

import { detectSupertrendBullishFlip } from '@/domain/signals/confirmed';
import type { SupertrendResult } from '@/domain/types';

function withSupertrend(values: SupertrendResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, supertrend: values };
}

describe('detectSupertrendBullishFlip', () => {
    describe('최근 3 bar 내 down→up 전환이 있을 때', () => {
        it('Signal을 전환 bar 인덱스로 반환한다', () => {
            const bars = buildBars(10);
            const st: SupertrendResult[] = [
                ...Array(7).fill({ supertrend: 100, trend: 'down' as const }),
                { supertrend: 100, trend: 'up' as const },
                { supertrend: 100, trend: 'up' as const },
                { supertrend: 100, trend: 'up' as const },
            ];
            const result = detectSupertrendBullishFlip(bars, withSupertrend(st));
            expect(result).not.toBeNull();
            expect(result?.type).toBe('supertrend_bullish_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 전환이 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const st: SupertrendResult[] = [
                ...Array(3).fill({ supertrend: 100, trend: 'down' as const }),
                ...Array(7).fill({ supertrend: 100, trend: 'up' as const }),
            ];
            // 전환이 index 3에서 일어났으나 CROSS_LOOKBACK_BARS=3보다 오래됨
            expect(detectSupertrendBullishFlip(bars, withSupertrend(st))).toBeNull();
        });
    });

    describe('supertrend 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(
                detectSupertrendBullishFlip(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('직전 trend가 null일 때', () => {
        it('null을 반환한다 (전환 불명확)', () => {
            const bars = buildBars(5);
            const st: SupertrendResult[] = [
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: 100, trend: 'up' as const },
            ];
            expect(detectSupertrendBullishFlip(bars, withSupertrend(st))).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test -- confirmed.test.ts
```

Expected: FAIL — "detectSupertrendBullishFlip is not a function" 또는 import 오류

- [ ] **Step 3: 구현 추가**

`src/domain/signals/confirmed.ts` 파일 끝에 추가:

```typescript
import { CROSS_LOOKBACK_BARS } from '@/domain/signals/constants';

export function detectSupertrendBullishFlip(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const st = indicators.supertrend;
    if (st.length < 2) return null;
    const lastIdx = st.length - 1;
    const start = Math.max(1, lastIdx - CROSS_LOOKBACK_BARS + 1);
    for (let i = start; i <= lastIdx; i++) {
        const prev = st[i - 1]?.trend;
        const cur = st[i]?.trend;
        if (prev === 'down' && cur === 'up') {
            return {
                type: 'supertrend_bullish_flip',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: i,
            };
        }
    }
    return null;
}
```

> 주의: `CROSS_LOOKBACK_BARS` import는 파일 상단의 기존 import 블록에 이미 있다면 추가하지 않음. 없다면 기존 `import { ... CROSS_LOOKBACK_BARS ... } from '@/domain/signals/constants';` 블록에 추가.

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test -- confirmed.test.ts
```

Expected: PASS (detectSupertrendBullishFlip 4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectSupertrendBullishFlip detector"
```

---

## Task 5: Ichimoku cloud breakout 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`confirmed.test.ts` 끝에 추가:

```typescript
// ─── detectIchimokuCloudBreakout ──────────────────────────────────────────────

import { detectIchimokuCloudBreakout } from '@/domain/signals/confirmed';
import type { IchimokuResult } from '@/domain/types';

function withIchimoku(values: IchimokuResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, ichimoku: values };
}

function barsWithClose(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c, high: c, low: c, close: c, volume: 1000,
    }));
}

describe('detectIchimokuCloudBreakout', () => {
    const nullCloud: IchimokuResult = {
        tenkan: null, kijun: null, senkouA: null, senkouB: null, chikou: null,
    };

    describe('직전은 구름 아래, 최신 bar가 처음 돌파할 때', () => {
        it('Signal을 반환한다', () => {
            const bars = barsWithClose([95, 96, 97, 105]);
            const ichimoku: IchimokuResult[] = [
                nullCloud, nullCloud,
                { ...nullCloud, senkouA: 100, senkouB: 99 }, // prev kumoUpper=100, prev.close=97 ≤ 100 ✓
                { ...nullCloud, senkouA: 102, senkouB: 100 }, // cur kumoUpper=102, cur.close=105 > 102 ✓
            ];
            const result = detectIchimokuCloudBreakout(bars, withIchimoku(ichimoku));
            expect(result?.type).toBe('ichimoku_cloud_breakout');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(3);
        });
    });

    describe('직전 bar가 이미 구름 위에 있을 때', () => {
        it('null을 반환한다 (오탐지 방지)', () => {
            const bars = barsWithClose([95, 96, 100, 105]);
            const ichimoku: IchimokuResult[] = [
                nullCloud, nullCloud,
                { ...nullCloud, senkouA: 98, senkouB: 99 }, // prev kumoUpper=99, prev.close=100 > 99 (already above)
                { ...nullCloud, senkouA: 102, senkouB: 100 },
            ];
            expect(
                detectIchimokuCloudBreakout(bars, withIchimoku(ichimoku))
            ).toBeNull();
        });
    });

    describe('구름 데이터가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = barsWithClose([95, 100]);
            const ichimoku: IchimokuResult[] = [nullCloud, nullCloud];
            expect(
                detectIchimokuCloudBreakout(bars, withIchimoku(ichimoku))
            ).toBeNull();
        });
    });

    describe('bars 길이가 2 미만일 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectIchimokuCloudBreakout(barsWithClose([100]), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test -- confirmed.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현**

`confirmed.ts` 끝에 추가:

```typescript
export function detectIchimokuCloudBreakout(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const ichimoku = indicators.ichimoku;
    if (bars.length < 2 || ichimoku.length < 2) return null;
    const lastIdx = bars.length - 1;

    const prevIchi = ichimoku[lastIdx - 1];
    const curIchi = ichimoku[lastIdx];
    if (
        prevIchi.senkouA === null ||
        prevIchi.senkouB === null ||
        curIchi.senkouA === null ||
        curIchi.senkouB === null
    ) {
        return null;
    }
    const prevKumoUpper = Math.max(prevIchi.senkouA, prevIchi.senkouB);
    const curKumoUpper = Math.max(curIchi.senkouA, curIchi.senkouB);
    const prevClose = bars[lastIdx - 1].close;
    const curClose = bars[lastIdx].close;
    if (prevClose > prevKumoUpper) return null;
    if (curClose <= curKumoUpper) return null;

    return {
        type: 'ichimoku_cloud_breakout',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test -- confirmed.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectIchimokuCloudBreakout detector"
```

---

## Task 6: CCI bullish cross 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectCciBullishCross ────────────────────────────────────────────────────

import { detectCciBullishCross } from '@/domain/signals/confirmed';

function withCci(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, cci: values };
}

describe('detectCciBullishCross', () => {
    describe('최근 3 bar 내 -100 상향 돌파가 있을 때', () => {
        it('Signal을 전환 bar로 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(7).fill(-120),
                -80,  // -100 상향 돌파 (index 7)
                -70, -60,
            ];
            const result = detectCciBullishCross(bars, withCci(cci));
            expect(result?.type).toBe('cci_bullish_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 +100 상향 돌파가 있을 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(7).fill(80),
                120, 130, 140,  // +100 상향 돌파 (index 7)
            ];
            const result = detectCciBullishCross(bars, withCci(cci));
            expect(result?.type).toBe('cci_bullish_cross');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 돌파가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(3).fill(-120),
                ...Array(7).fill(-80),  // 돌파는 index 3에서 발생했으나 lookback=3 초과
            ];
            expect(detectCciBullishCross(bars, withCci(cci))).toBeNull();
        });
    });

    describe('CCI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectCciBullishCross(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test -- confirmed.test.ts
```

- [ ] **Step 3: 구현**

`confirmed.ts` 끝에 추가:

```typescript
import {
    CCI_OVERSOLD_CROSS_LEVEL,
    CCI_BULLISH_CROSS_LEVEL,
} from '@/domain/signals/constants';

export function detectCciBullishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const cci = indicators.cci;
    if (cci.length < 2) return null;
    const thresholds = [CCI_OVERSOLD_CROSS_LEVEL, CCI_BULLISH_CROSS_LEVEL];
    for (const threshold of thresholds) {
        const thresholdArr = cci.map(() => threshold);
        const idx = findCross(cci, thresholdArr, CROSS_LOOKBACK_BARS, 'up');
        if (idx !== null) {
            return {
                type: 'cci_bullish_cross',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: idx,
            };
        }
    }
    return null;
}
```

> import 블록에 `CCI_OVERSOLD_CROSS_LEVEL`·`CCI_BULLISH_CROSS_LEVEL` 추가.

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectCciBullishCross detector"
```

---

## Task 7: DMI bullish cross 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectDmiBullishCross ────────────────────────────────────────────────────

import { detectDmiBullishCross } from '@/domain/signals/confirmed';
import type { DMIResult } from '@/domain/types';

function withDmi(values: DMIResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, dmi: values };
}

describe('detectDmiBullishCross', () => {
    describe('+DI가 -DI 상향 돌파 + ADX ≥ 20일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = [
                ...Array(7).fill({ diPlus: 15, diMinus: 25, adx: 22 }),
                { diPlus: 28, diMinus: 20, adx: 25 },  // index 7 cross + ADX=25
                { diPlus: 30, diMinus: 18, adx: 28 },
                { diPlus: 32, diMinus: 16, adx: 30 },
            ];
            const result = detectDmiBullishCross(bars, withDmi(dmi));
            expect(result?.type).toBe('dmi_bullish_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('+DI가 -DI 상향 돌파했으나 ADX < 20일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = [
                ...Array(7).fill({ diPlus: 15, diMinus: 25, adx: 15 }),
                { diPlus: 28, diMinus: 20, adx: 18 },  // cross but ADX=18 < 20
                { diPlus: 30, diMinus: 18, adx: 18 },
                { diPlus: 32, diMinus: 16, adx: 18 },
            ];
            expect(detectDmiBullishCross(bars, withDmi(dmi))).toBeNull();
        });
    });

    describe('cross가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = Array(10).fill({
                diPlus: 15, diMinus: 25, adx: 30,
            });
            expect(detectDmiBullishCross(bars, withDmi(dmi))).toBeNull();
        });
    });

    describe('DMI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectDmiBullishCross(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`confirmed.ts` 끝에 추가:

```typescript
import { DMI_ADX_TREND_THRESHOLD } from '@/domain/signals/constants';

export function detectDmiBullishCross(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const dmi = indicators.dmi;
    if (dmi.length < 2) return null;
    const diPlus = dmi.map(d => d.diPlus);
    const diMinus = dmi.map(d => d.diMinus);
    const idx = findCross(diPlus, diMinus, CROSS_LOOKBACK_BARS, 'up');
    if (idx === null) return null;
    const adxAtCross = dmi[idx].adx;
    if (adxAtCross === null || adxAtCross < DMI_ADX_TREND_THRESHOLD) return null;
    return {
        type: 'dmi_bullish_cross',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: idx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectDmiBullishCross detector"
```

---

## Task 8: CMF bullish flip 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectCmfBullishFlip ─────────────────────────────────────────────────────

import { detectCmfBullishFlip } from '@/domain/signals/confirmed';

function withCmf(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, cmf: values };
}

describe('detectCmfBullishFlip', () => {
    describe('최근 3 bar 내 CMF가 0 상향 돌파할 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const cmf = [
                ...Array(7).fill(-0.1),
                0.05,  // 0 상향 돌파 (index 7)
                0.1, 0.15,
            ];
            const result = detectCmfBullishFlip(bars, withCmf(cmf));
            expect(result?.type).toBe('cmf_bullish_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 돌파가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const cmf = [...Array(3).fill(-0.1), ...Array(7).fill(0.1)];
            expect(detectCmfBullishFlip(bars, withCmf(cmf))).toBeNull();
        });
    });

    describe('CMF 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectCmfBullishFlip(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

```typescript
import { CMF_BULLISH_CROSS_LEVEL } from '@/domain/signals/constants';

export function detectCmfBullishFlip(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const cmf = indicators.cmf;
    if (cmf.length < 2) return null;
    const thresholdArr = cmf.map(() => CMF_BULLISH_CROSS_LEVEL);
    const idx = findCross(cmf, thresholdArr, CROSS_LOOKBACK_BARS, 'up');
    if (idx === null) return null;
    return {
        type: 'cmf_bullish_flip',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: idx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectCmfBullishFlip detector"
```

---

## Task 9: MFI oversold bounce 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectMfiOversoldBounce ──────────────────────────────────────────────────

import { detectMfiOversoldBounce } from '@/domain/signals/confirmed';

function withMfi(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, mfi: values };
}

describe('detectMfiOversoldBounce', () => {
    describe('직전 MFI < 20, 최신 MFI ≥ 20일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(15), 22];
            const result = detectMfiOversoldBounce(bars, withMfi(mfi));
            expect(result?.type).toBe('mfi_oversold_bounce');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(9);
        });
    });

    describe('직전 MFI가 이미 20 이상이었을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(25), 30];
            expect(detectMfiOversoldBounce(bars, withMfi(mfi))).toBeNull();
        });
    });

    describe('최신 MFI가 여전히 20 미만일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(15), 18];
            expect(detectMfiOversoldBounce(bars, withMfi(mfi))).toBeNull();
        });
    });

    describe('MFI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectMfiOversoldBounce(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

```typescript
import { MFI_OVERSOLD_LEVEL } from '@/domain/signals/constants';

export function detectMfiOversoldBounce(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const mfi = indicators.mfi;
    if (mfi.length < 2) return null;
    const lastIdx = mfi.length - 1;
    const prev = mfi[lastIdx - 1];
    const cur = mfi[lastIdx];
    if (prev === null || cur === null) return null;
    if (prev >= MFI_OVERSOLD_LEVEL) return null;
    if (cur < MFI_OVERSOLD_LEVEL) return null;
    return {
        type: 'mfi_oversold_bounce',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectMfiOversoldBounce detector"
```

---

## Task 10: Parabolic SAR flip 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectParabolicSarFlip ───────────────────────────────────────────────────

import { detectParabolicSarFlip } from '@/domain/signals/confirmed';
import type { ParabolicSARResult } from '@/domain/types';

function withSar(values: ParabolicSARResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, parabolicSar: values };
}

describe('detectParabolicSarFlip', () => {
    describe('최근 3 bar 내 down→up 전환일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const sar: ParabolicSARResult[] = [
                ...Array(7).fill({ sar: 110, trend: 'down' as const }),
                { sar: 95, trend: 'up' as const },  // flip at index 7
                { sar: 93, trend: 'up' as const },
                { sar: 91, trend: 'up' as const },
            ];
            const result = detectParabolicSarFlip(bars, withSar(sar));
            expect(result?.type).toBe('parabolic_sar_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('lookback 초과 범위 전환일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const sar: ParabolicSARResult[] = [
                ...Array(3).fill({ sar: 110, trend: 'down' as const }),
                ...Array(7).fill({ sar: 95, trend: 'up' as const }),
            ];
            expect(detectParabolicSarFlip(bars, withSar(sar))).toBeNull();
        });
    });

    describe('SAR 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectParabolicSarFlip(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

```typescript
export function detectParabolicSarFlip(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const sar = indicators.parabolicSar;
    if (sar.length < 2) return null;
    const lastIdx = sar.length - 1;
    const start = Math.max(1, lastIdx - CROSS_LOOKBACK_BARS + 1);
    for (let i = start; i <= lastIdx; i++) {
        const prev = sar[i - 1]?.trend;
        const cur = sar[i]?.trend;
        if (prev === 'down' && cur === 'up') {
            return {
                type: 'parabolic_sar_flip',
                direction: 'bullish',
                phase: 'confirmed',
                detectedAt: i,
            };
        }
    }
    return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectParabolicSarFlip detector"
```

---

## Task 11: Keltner upper breakout 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectKeltnerUpperBreakout ───────────────────────────────────────────────

import { detectKeltnerUpperBreakout } from '@/domain/signals/confirmed';
import type { KeltnerChannelResult } from '@/domain/types';

function withKeltner(values: KeltnerChannelResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, keltnerChannel: values };
}

describe('detectKeltnerUpperBreakout', () => {
    describe('직전 close ≤ upper, 최신 close > upper일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = barsWithClose([98, 105]);
            const keltner: KeltnerChannelResult[] = [
                { upper: 100, middle: 95, lower: 90 },  // prev close 98 ≤ 100 ✓
                { upper: 102, middle: 97, lower: 92 },  // cur close 105 > 102 ✓
            ];
            const result = detectKeltnerUpperBreakout(bars, withKeltner(keltner));
            expect(result?.type).toBe('keltner_upper_breakout');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(1);
        });
    });

    describe('직전 이미 upper 위였다면', () => {
        it('null을 반환한다', () => {
            const bars = barsWithClose([105, 110]);
            const keltner: KeltnerChannelResult[] = [
                { upper: 100, middle: 95, lower: 90 },  // prev close 105 > 100
                { upper: 102, middle: 97, lower: 92 },
            ];
            expect(
                detectKeltnerUpperBreakout(bars, withKeltner(keltner))
            ).toBeNull();
        });
    });

    describe('upper가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = barsWithClose([98, 105]);
            const keltner: KeltnerChannelResult[] = [
                { upper: null, middle: null, lower: null },
                { upper: null, middle: null, lower: null },
            ];
            expect(
                detectKeltnerUpperBreakout(bars, withKeltner(keltner))
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

```typescript
export function detectKeltnerUpperBreakout(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const keltner = indicators.keltnerChannel;
    if (bars.length < 2 || keltner.length < 2) return null;
    const lastIdx = bars.length - 1;
    const prevKc = keltner[lastIdx - 1];
    const curKc = keltner[lastIdx];
    if (prevKc.upper === null || curKc.upper === null) return null;
    const prevClose = bars[lastIdx - 1].close;
    const curClose = bars[lastIdx].close;
    if (prevClose > prevKc.upper) return null;
    if (curClose <= curKc.upper) return null;
    return {
        type: 'keltner_upper_breakout',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: lastIdx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectKeltnerUpperBreakout detector"
```

---

## Task 12: Squeeze Momentum bullish 탐지기

**Files:**
- Modify: `src/domain/signals/confirmed.ts`
- Modify: `src/__tests__/domain/signals/confirmed.test.ts`

- [ ] **Step 1: 테스트 작성**

```typescript
// ─── detectSqueezeMomentumBullish ─────────────────────────────────────────────

import { detectSqueezeMomentumBullish } from '@/domain/signals/confirmed';
import type { SqueezeMomentumResult } from '@/domain/types';

function withSqueezeMomentum(values: SqueezeMomentumResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, squeezeMomentum: values };
}

function sqz(momentum: number | null): SqueezeMomentumResult {
    return { momentum, sqzOn: null, sqzOff: null, noSqz: null, increasing: null };
}

describe('detectSqueezeMomentumBullish', () => {
    describe('최근 3 bar 내 histogram 0 상향 돌파일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const values = [
                ...Array(7).fill(sqz(-0.5)),
                sqz(0.3),  // 0 상향 돌파 (index 7)
                sqz(0.5),
                sqz(0.7),
            ];
            const result = detectSqueezeMomentumBullish(
                bars, withSqueezeMomentum(values)
            );
            expect(result?.type).toBe('squeeze_momentum_bullish');
            expect(result?.direction).toBe('bullish');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('lookback 초과 범위일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const values = [
                ...Array(3).fill(sqz(-0.5)),
                ...Array(7).fill(sqz(0.3)),
            ];
            expect(
                detectSqueezeMomentumBullish(bars, withSqueezeMomentum(values))
            ).toBeNull();
        });
    });

    describe('momentum이 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const values = Array(5).fill(sqz(null));
            expect(
                detectSqueezeMomentumBullish(bars, withSqueezeMomentum(values))
            ).toBeNull();
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

```typescript
import { SQUEEZE_MOMENTUM_ZERO_CROSS } from '@/domain/signals/constants';

export function detectSqueezeMomentumBullish(
    bars: Bar[],
    indicators: IndicatorResult
): Signal | null {
    const sqz = indicators.squeezeMomentum;
    if (sqz.length < 2) return null;
    const momentum = sqz.map(s => s.momentum);
    const thresholdArr = momentum.map(() => SQUEEZE_MOMENTUM_ZERO_CROSS);
    const idx = findCross(momentum, thresholdArr, CROSS_LOOKBACK_BARS, 'up');
    if (idx === null) return null;
    return {
        type: 'squeeze_momentum_bullish',
        direction: 'bullish',
        phase: 'confirmed',
        detectedAt: idx,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```bash
git add src/domain/signals/confirmed.ts src/__tests__/domain/signals/confirmed.test.ts
git commit -m "feat(signals): add detectSqueezeMomentumBullish detector"
```

---

## Task 13: DETECTORS 배열에 9개 탐지기 등록

**Files:**
- Modify: `src/domain/signals/index.ts`
- Modify: `src/__tests__/domain/signals/index.test.ts`

- [ ] **Step 1: index.ts의 import 및 DETECTORS 배열 업데이트**

`src/domain/signals/index.ts`를 다음으로 교체:

```typescript
import type { Bar, IndicatorResult, Signal } from '@/domain/types';
import {
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectCciBullishCross,
    detectCmfBullishFlip,
    detectDeathCross,
    detectDmiBullishCross,
    detectGoldenCross,
    detectIchimokuCloudBreakout,
    detectKeltnerUpperBreakout,
    detectMacdBearishCross,
    detectMacdBullishCross,
    detectMfiOversoldBounce,
    detectParabolicSarFlip,
    detectRsiOverbought,
    detectRsiOversold,
    detectSqueezeMomentumBullish,
    detectSupertrendBullishFlip,
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

export { classifyTrend } from '@/domain/signals/trend';

type Detector = (bars: Bar[], indicators: IndicatorResult) => Signal | null;

const DETECTORS: readonly Detector[] = [
    // Confirmed bullish/bearish
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
    detectMacdBullishCross,
    detectMacdBearishCross,
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    // Confirmed bullish (Task 4-12 신규)
    detectSupertrendBullishFlip,
    detectIchimokuCloudBreakout,
    detectCciBullishCross,
    detectDmiBullishCross,
    detectCmfBullishFlip,
    detectMfiOversoldBounce,
    detectParabolicSarFlip,
    detectKeltnerUpperBreakout,
    detectSqueezeMomentumBullish,
    // Anticipation
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

- [ ] **Step 2: 기존 index.test.ts가 통과하는지 확인**

```bash
yarn test -- signals
```

Expected: PASS — 신규 탐지기 미포함 테스트도 영향 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/signals/index.ts
git commit -m "feat(signals): register 9 new bullish detectors in DETECTORS"
```

---

## Task 14: Signal.type → 태그 라벨 맵

**Files:**
- Create: `src/domain/backtest/tags.ts`
- Create: `src/__tests__/domain/backtest/tags.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/backtest/tags.test.ts`:

```typescript
import { signalTypeToTagLabel } from '@/domain/backtest/tags';

describe('signalTypeToTagLabel', () => {
    describe('기존 confirmed bullish 타입', () => {
        it.each([
            ['rsi_oversold', 'RSI 과매도 반등'],
            ['golden_cross', 'EMA 골든크로스'],
            ['macd_bullish_cross', 'MACD 골든크로스'],
            ['bollinger_lower_bounce', 'BB 하단 반등'],
        ])('%s → %s', (type, expected) => {
            expect(signalTypeToTagLabel(type)).toBe(expected);
        });
    });

    describe('anticipation bullish 타입', () => {
        it.each([
            ['rsi_bullish_divergence', 'RSI 강세 다이버전스'],
            ['macd_histogram_bullish_convergence', 'MACD 히스토그램 강세 수렴'],
            ['bollinger_squeeze_bullish', 'BB 수축 강세'],
            ['support_proximity_bullish', '지지선 근접'],
        ])('%s → %s', (type, expected) => {
            expect(signalTypeToTagLabel(type)).toBe(expected);
        });
    });

    describe('신규 confirmed bullish 타입 (Task 4-12)', () => {
        it.each([
            ['supertrend_bullish_flip', 'Supertrend 전환'],
            ['ichimoku_cloud_breakout', 'Ichimoku 구름 돌파'],
            ['cci_bullish_cross', 'CCI 100 돌파'],
            ['dmi_bullish_cross', 'DMI 골든크로스'],
            ['cmf_bullish_flip', 'CMF 매집 전환'],
            ['mfi_oversold_bounce', 'MFI 과매도 반등'],
            ['parabolic_sar_flip', 'Parabolic SAR 전환'],
            ['keltner_upper_breakout', 'Keltner 상단 돌파'],
            ['squeeze_momentum_bullish', 'Squeeze 양전환'],
        ])('%s → %s', (type, expected) => {
            expect(signalTypeToTagLabel(type)).toBe(expected);
        });
    });

    describe('알 수 없는 타입', () => {
        it('fallback으로 타입 문자열 자체를 반환한다', () => {
            expect(signalTypeToTagLabel('unknown_signal')).toBe('unknown_signal');
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test -- tags.test.ts
```

Expected: FAIL — "Cannot find module '@/domain/backtest/tags'"

- [ ] **Step 3: 구현**

`src/domain/backtest/tags.ts`:

```typescript
const TAG_LABEL_MAP: Record<string, string> = {
    // 기존 confirmed bullish
    rsi_oversold: 'RSI 과매도 반등',
    golden_cross: 'EMA 골든크로스',
    macd_bullish_cross: 'MACD 골든크로스',
    bollinger_lower_bounce: 'BB 하단 반등',
    // 기존 anticipation bullish
    rsi_bullish_divergence: 'RSI 강세 다이버전스',
    macd_histogram_bullish_convergence: 'MACD 히스토그램 강세 수렴',
    bollinger_squeeze_bullish: 'BB 수축 강세',
    support_proximity_bullish: '지지선 근접',
    // 신규 confirmed bullish
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

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test -- tags.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domain/backtest/tags.ts src/__tests__/domain/backtest/tags.test.ts
git commit -m "feat(backtest): add signalTypeToTagLabel with bullish-only map"
```

---

## Task 15: Exit 시뮬레이션 순수 함수

**Files:**
- Create: `src/domain/backtest/exit.ts`
- Create: `src/__tests__/domain/backtest/exit.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/backtest/exit.test.ts`:

```typescript
import { simulateExit } from '@/domain/backtest/exit';
import type { Bar } from '@/domain/types';

function bar(low: number, high: number, close: number, idx = 0): Bar {
    return {
        time: 1700000000 + idx * 86400,
        open: close, low, high, close, volume: 1000,
    };
}

describe('simulateExit', () => {
    describe('TP가 먼저 달성될 때', () => {
        it('take_profit exit을 반환한다', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0), // entry bar
                bar(99, 101, 100, 1),  // 변동 작음
                bar(102, 110, 108, 2), // TP=105 달성
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitIdx).toBe(2);
            expect(result.exitPrice).toBe(105);
            expect(result.exitReason).toBe('take_profit');
            expect(result.holdingDays).toBe(2);
            expect(result.returnPct).toBeCloseTo(5.0, 3);
        });
    });

    describe('SL이 먼저 발동될 때', () => {
        it('stop_loss exit을 반환한다', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(90, 100, 93, 1),   // SL=95 발동
                bar(100, 110, 108, 2),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitIdx).toBe(1);
            expect(result.exitPrice).toBe(95);
            expect(result.exitReason).toBe('stop_loss');
            expect(result.returnPct).toBeCloseTo(-5.0, 3);
        });
    });

    describe('동일 bar에서 SL·TP 모두 발동할 때', () => {
        it('SL을 우선 반환한다 (보수적 가정)', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(94, 106, 100, 1),  // low≤95 AND high≥105
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitReason).toBe('stop_loss');
            expect(result.exitPrice).toBe(95);
        });
    });

    describe('SL·TP 모두 미발동 → 시간 만기', () => {
        it('time exit을 반환하고 close 가격 사용', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(99, 102, 101, 1),
                bar(100, 104, 103, 2),
                bar(100, 104, 102, 3),  // maxHoldDays=3 만기
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 110,
                maxHoldDays: 3,
            });
            expect(result.exitIdx).toBe(3);
            expect(result.exitPrice).toBe(102);
            expect(result.exitReason).toBe('time');
            expect(result.holdingDays).toBe(3);
        });
    });

    describe('SL·TP 모두 undefined', () => {
        it('항상 time exit으로 만기 bar close 반환', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(90, 115, 110, 1),  // 극단적 변동이어도 무시
                bar(100, 105, 103, 2),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: undefined,
                takeProfit: undefined,
                maxHoldDays: 2,
            });
            expect(result.exitReason).toBe('time');
            expect(result.exitIdx).toBe(2);
            expect(result.exitPrice).toBe(103);
        });
    });

    describe('maxHoldDays가 bars 길이를 초과할 때', () => {
        it('가용 마지막 bar에서 time exit', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(100, 102, 101, 1),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 90,
                takeProfit: 110,
                maxHoldDays: 10,
            });
            expect(result.exitReason).toBe('time');
            expect(result.exitIdx).toBe(1);
            expect(result.exitPrice).toBe(101);
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test -- exit.test.ts
```

Expected: FAIL — "Cannot find module '@/domain/backtest/exit'"

- [ ] **Step 3: 구현**

`src/domain/backtest/exit.ts`:

```typescript
import type { Bar, BacktestExitReason } from '@/domain/types';

export interface ExitSimulationInput {
    bars: Bar[];
    entryIdx: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    maxHoldDays: number;
}

export interface ExitSimulationResult {
    exitIdx: number;
    exitPrice: number;
    exitReason: BacktestExitReason;
    holdingDays: number;
    returnPct: number;
}

function buildResult(
    exitIdx: number,
    exitPrice: number,
    exitReason: BacktestExitReason,
    entryIdx: number,
    entryPrice: number
): ExitSimulationResult {
    return {
        exitIdx,
        exitPrice,
        exitReason,
        holdingDays: exitIdx - entryIdx,
        returnPct: ((exitPrice - entryPrice) / entryPrice) * 100,
    };
}

export function simulateExit(
    input: ExitSimulationInput
): ExitSimulationResult {
    const { bars, entryIdx, entryPrice, stopLoss, takeProfit, maxHoldDays } =
        input;
    const maxIdx = Math.min(entryIdx + maxHoldDays, bars.length - 1);

    for (let i = entryIdx + 1; i <= maxIdx; i++) {
        const b = bars[i];
        const hitSL = stopLoss !== undefined && b.low <= stopLoss;
        const hitTP = takeProfit !== undefined && b.high >= takeProfit;

        // 동일 bar 내 SL·TP 동시 발동 시 보수적으로 SL 우선
        if (hitSL) {
            return buildResult(i, stopLoss!, 'stop_loss', entryIdx, entryPrice);
        }
        if (hitTP) {
            return buildResult(
                i,
                takeProfit!,
                'take_profit',
                entryIdx,
                entryPrice
            );
        }
    }

    // time exit: 보유 만기 bar close
    const exitBar = bars[maxIdx];
    return buildResult(maxIdx, exitBar.close, 'time', entryIdx, entryPrice);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test -- exit.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/backtest/exit.ts src/__tests__/domain/backtest/exit.test.ts
git commit -m "feat(backtest): add simulateExit pure function with SL/TP/time"
```

---

## Task 16: generate-backtest 스크립트 전면 교체

**Files:**
- Modify: `scripts/backtests/generate-backtest.ts`

이 태스크는 TDD 불가(통합 스크립트). 스펙대로 작성 후 컴파일 성공 확인.

- [ ] **Step 1: 전체 파일을 다음으로 교체**

`scripts/backtests/generate-backtest.ts`:

```typescript
/**
 * 백테스팅 데이터 생성 스크립트 (멀티-시그널 confluence 기반)
 *
 * 사용법: npx tsx scripts/backtests/generate-backtest.ts
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY           — Financial Modeling Prep API 키
 *   GEMINI_FREE_API_KEY   — Google AI Studio 무료 API 키 (Gemini 2.5 Flash-lite)
 *
 * 출력: src/app/backtesting/data.json
 *
 * 설계 문서: docs/superpowers/specs/2026-04-20-multi-signal-backtest-design.md
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { calculateIndicators } from '@/domain/indicators';
import { detectSignals } from '@/domain/signals';
import { simulateExit } from '@/domain/backtest/exit';
import { signalTypeToTagLabel } from '@/domain/backtest/tags';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import { parseJsonResponse } from '@/infrastructure/ai/utils';
import { callGeminiScript } from './ai.js';
import type {
    Bar,
    BacktestAiResult,
    BacktestCase,
    BacktestExitReason,
    BacktestMeta,
    BacktestSignalResult,
    EntryRecommendation,
    RawAnalysisResponse,
    Trend,
} from '@/domain/types';

config({ path: resolve(process.cwd(), '.env.local') });

// ─── 설정 ──────────────────────────────────────────────────────────────────────

const TICKERS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'PLTR', 'CRWD', 'MSTR',
];
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_API_KEY = process.env.FMP_API_KEY ?? '';
const GEMINI_FREE_API_KEY = process.env.GEMINI_FREE_API_KEY ?? '';

// spec: meta.period '2025.04 – 2026.04'. Fetch는 warmup 위해 앞으로 ~150 bar 확장
const FROM_DATE_FETCH = '2024-09-01';
const DISPLAY_START_DATE = '2025-04-01';
const TO_DATE = '2026-04-20';

const OUTPUT_PATH = resolve(process.cwd(), 'src/app/backtesting/data.json');
const MAX_SIGNALS_PER_TICKER = 10;
const MAX_TAGS_PER_CASE = 3;
const MIN_BARS = 120;               // SQUEEZE_LOOKBACK_BARS 맞춤
const MIN_CONFLUENCE = 2;
const HOLD_DAYS = 10;
const CONTEXT_BARS = 120;
const GEMINI_SLEEP_MS = 5_000;
const FMP_SLEEP_MS = 1_000;
const MAX_RETRIES = 5;
const DEFAULT_RETRY_AFTER_MS = 60_000;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

if (!FMP_API_KEY) throw new Error('FMP_API_KEY is required in .env.local');
if (!GEMINI_FREE_API_KEY)
    throw new Error('GEMINI_FREE_API_KEY is required in .env.local');

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ─── FMP bars ──────────────────────────────────────────────────────────────────

interface FmpBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

async function fetchDailyBars(ticker: string): Promise<FmpBar[]> {
    const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${ticker}&from=${FROM_DATE_FETCH}&to=${TO_DATE}&apikey=${FMP_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`FMP fetch failed for ${ticker}: ${res.status}`);
    const json = (await res.json()) as { historical?: FmpBar[] };
    return (json.historical ?? []).slice().reverse();
}

function toBarArray(fmpBars: FmpBar[]): Bar[] {
    return fmpBars.map(b => ({
        time: Math.floor(new Date(b.date).getTime() / 1000),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
    }));
}

// ─── 후보 탐지 (confluence + cooldown + display range) ─────────────────────────

interface EntryCandidate {
    idx: number;
    entryDate: string;
    entryPrice: number;
    signalTypes: string[];
}

function findEntryCandidates(
    bars: Bar[],
    fmpBars: FmpBar[]
): EntryCandidate[] {
    const candidates: EntryCandidate[] = [];
    let cooldownUntil = -1;

    if (bars.length < MIN_BARS + 1) return candidates;

    // 시딩: MIN_BARS-1 시점의 bullish 상태. 누락 시 첫 반복에서 phantom confluence 발생
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
        const fresh = [...bullishTypes].filter(t => !lastBullishTypes.has(t));

        const entryDate = fmpBars[i].date;
        const inDisplayRange = entryDate >= DISPLAY_START_DATE;

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

        // pre-display 구간에서도 상태 업데이트 유지
        lastBullishTypes = bullishTypes;
    }

    return candidates.slice(-MAX_SIGNALS_PER_TICKER);
}

// ─── Gemini 호출 retry ────────────────────────────────────────────────────────

function parseRetryAfterMs(err: unknown): number {
    const msg = err instanceof Error ? err.message : String(err);
    const delayMatch = /"retryDelay"\s*:\s*"(\d+)s"/i.exec(msg);
    if (delayMatch) return parseInt(delayMatch[1], 10) * 1000;
    const headerMatch = /retry-after[:\s]+(\d+)/i.exec(msg);
    if (headerMatch) return parseInt(headerMatch[1], 10) * 1000;
    if (typeof err === 'object' && err !== null) {
        const headers = (err as Record<string, unknown>).headers;
        if (typeof headers === 'object' && headers !== null) {
            const ra = (headers as Record<string, unknown>)['retry-after'];
            if (ra !== undefined) return parseInt(String(ra), 10) * 1000;
        }
    }
    return DEFAULT_RETRY_AFTER_MS;
}

function is429(err: unknown): boolean {
    if (typeof err === 'object' && err !== null) {
        if ((err as Record<string, unknown>).status === 429) return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('429') || /resource.?exhausted/i.test(msg);
}

async function callGeminiWithRetryAfter(prompt: string): Promise<string> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await callGeminiScript(
                prompt,
                GEMINI_FREE_API_KEY,
                GEMINI_MODEL
            );
        } catch (err) {
            if (is429(err) && attempt < MAX_RETRIES) {
                const waitMs = parseRetryAfterMs(err);
                console.log(
                    `  [429] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${waitMs / 1000}s...`
                );
                await sleep(waitMs + 500);
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}

// ─── AI 분석 ───────────────────────────────────────────────────────────────────

interface AiAnalysisForBacktest {
    trend: Trend;
    summary: string;
    entryRecommendation: EntryRecommendation;
    stopLoss?: number;
    takeProfit?: number;
    bullishTargets: number[];
}

const VALID_RECS: EntryRecommendation[] = ['enter', 'wait', 'avoid'];

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
    const prompt = buildAnalysisPrompt(
        ticker,
        contextBars,
        indicators,
        [],
        '1Day'
    );
    const text = await callGeminiWithRetryAfter(prompt);
    const raw = parseJsonResponse<RawAnalysisResponse>(text, 'analysis');
    const result = enrichAnalysisWithConfidence(raw, []);

    const rawRec = result.actionRecommendation?.entryRecommendation;
    const entryRecommendation: EntryRecommendation = VALID_RECS.includes(
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

// ─── 결과 판정 ─────────────────────────────────────────────────────────────────

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
    if (trend !== 'bullish' || bullishTargets.length === 0) return false;
    const firstTarget = bullishTargets[0];
    return bars
        .slice(entryIdx + 1, exitIdx + 1)
        .some(b => b.high >= firstTarget);
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
    let allCases: BacktestCase[] = [];

    for (const ticker of TICKERS) {
        console.log(`\n[${ticker}] Fetching bars...`);
        const fmpBars = await fetchDailyBars(ticker);
        await sleep(FMP_SLEEP_MS);
        if (fmpBars.length < MIN_BARS + 1) {
            console.log(`  Skipping — not enough bars (${fmpBars.length})`);
            continue;
        }
        const bars = toBarArray(fmpBars);

        const candidates = findEntryCandidates(bars, fmpBars);
        console.log(`  Found ${candidates.length} entry candidates`);

        for (const candidate of candidates) {
            const ai = await runAiAnalysis(ticker, bars, candidate.idx);

            // SL/TP 무결성 검증: bullish 매수는 stopLoss < entry < takeProfit 필수
            const safeStopLoss =
                ai.stopLoss !== undefined && ai.stopLoss < candidate.entryPrice
                    ? ai.stopLoss
                    : undefined;
            const safeTakeProfit =
                ai.takeProfit !== undefined &&
                ai.takeProfit > candidate.entryPrice
                    ? ai.takeProfit
                    : undefined;

            const exit = simulateExit({
                bars,
                entryIdx: candidate.idx,
                entryPrice: candidate.entryPrice,
                stopLoss: safeStopLoss,
                takeProfit: safeTakeProfit,
                maxHoldDays: HOLD_DAYS,
            });

            const result: BacktestSignalResult =
                exit.returnPct >= 0 ? 'win' : 'loss';
            const aiResult = computeAiResult(
                ai.entryRecommendation,
                exit.returnPct
            );
            const aiTrendHit = computeAiTrendHit(
                ai.trend,
                ai.bullishTargets,
                bars,
                candidate.idx,
                exit.exitIdx
            );

            const exitReason: BacktestExitReason = exit.exitReason;

            console.log(
                `  ${candidate.entryDate} → ${fmpBars[exit.exitIdx].date} | ${exit.returnPct.toFixed(1)}% (${result}, ${exitReason}, ai=${aiResult})`
            );

            allCases = [
                ...allCases,
                {
                    ticker,
                    entryDate: candidate.entryDate,
                    entryPrice: candidate.entryPrice,
                    exitDate: fmpBars[exit.exitIdx].date,
                    exitPrice: exit.exitPrice,
                    holdingDays: exit.holdingDays,
                    returnPct: Number(exit.returnPct.toFixed(2)),
                    signalType: 'buy',
                    result,
                    exitReason,
                    aiResult,
                    aiTrendHit,
                    aiAnalysis: {
                        summary: ai.summary,
                        tags: candidate.signalTypes.map(signalTypeToTagLabel),
                    },
                },
            ];

            await sleep(GEMINI_SLEEP_MS);
        }
    }

    const sortedCases = [...allCases].sort((a, b) =>
        a.entryDate.localeCompare(b.entryDate)
    );

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

    const output = { meta, cases: sortedCases };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n✓ Saved ${total} cases to ${OUTPUT_PATH}`);
    console.log(`  Signal win rate: ${meta.winRate}%`);
    console.log(`  AI win rate (decisive only): ${meta.aiWinRate}%`);
    console.log(`  AI trend hit rate: ${meta.aiTrendHitRate}%`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

Expected: 에러 없음. `EntryRecommendation`·`Trend` 등이 `@/domain/types`에 export되어 있어야 함 — 없다면 types.ts 추가 export 필요(기존 선언 존재 여부 먼저 확인).

- [ ] **Step 3: 린트**

```bash
yarn lint
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add scripts/backtests/generate-backtest.ts
git commit -m "feat(backtest): rewrite generate-backtest with multi-signal confluence + AI SL/TP exit sim"
```

---

## Task 17: 스크립트 실행 + data.json 생성

**Files:**
- Modify: `src/app/backtesting/data.json` (스크립트 출력물)

- [ ] **Step 1: .env.local에 API 키 확인**

```bash
grep -E "^(FMP_API_KEY|GEMINI_FREE_API_KEY)=" .env.local | wc -l
```

Expected: `2` (두 키 모두 존재)

없으면 사용자에게 `.env.local`에 두 키를 추가하도록 요청.

- [ ] **Step 2: 스크립트 실행 (약 15분 소요)**

```bash
npx tsx scripts/backtests/generate-backtest.ts
```

Expected 출력 예시:
```
[AAPL] Fetching bars...
  Found 7 entry candidates
  2025-05-14 → 2025-05-24 | +3.2% (win, time, ai=win)
  ...
[MSTR] Fetching bars...
  ...

✓ Saved 68 cases to /Users/.../src/app/backtesting/data.json
  Signal win rate: 66.2%
  AI win rate (decisive only): 61.0%
  AI trend hit rate: 48.5%
```

429 rate limit 발생 시 자동 재시도됨. 총 실행 시간 10~20분 예상.

- [ ] **Step 3: 생성된 JSON 검증**

```bash
node -e "
const d = require('./src/app/backtesting/data.json');
console.log('cases:', d.cases.length);
console.log('meta:', JSON.stringify(d.meta, null, 2));
const tags = new Set(d.cases.flatMap(c => c.aiAnalysis.tags));
console.log('unique tags:', tags.size, [...tags].slice(0, 10));
const exitReasons = new Set(d.cases.map(c => c.exitReason));
console.log('exit reasons:', [...exitReasons]);
const aiResults = new Set(d.cases.map(c => c.aiResult));
console.log('ai results:', [...aiResults]);
"
```

Expected 검증 기준:
- `cases` 길이 ≥ 30
- `unique tags` ≥ 5
- `exit reasons`: `take_profit`/`stop_loss`/`time` 중 최소 2종
- `ai results`: `win`/`loss`/`neutral` 중 최소 2종
- `cases.length`가 기대치 미달(< 30)이면 `MIN_CONFLUENCE=1`로 낮춘 뒤 재실행

- [ ] **Step 4: 데이터 커밋**

```bash
git add src/app/backtesting/data.json
git commit -m "chore(backtest): regenerate data.json with multi-signal confluence"
```

---

## Task 18: 전체 테스트 + 린트 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
yarn test
```

Expected: 전체 PASS. 기존 테스트 영향 없음, 신규 테스트 (Task 4-12, 14, 15) PASS.

- [ ] **Step 2: 커버리지 확인**

```bash
yarn test-coverage
```

Expected: `src/domain/signals/`와 `src/domain/backtest/`가 100% 커버리지 유지

- [ ] **Step 3: 린트 + 스타일**

```bash
yarn lint && yarn lint:style
```

Expected: 에러 없음

- [ ] **Step 4: 빌드**

```bash
yarn build
```

Expected: `/backtesting` 라우트 정적 페이지 생성 성공. `data.json` import 타입 오류 없음.

- [ ] **Step 5: 개발 서버에서 렌더링 확인**

```bash
yarn dev
```

브라우저에서 `http://localhost:4200/backtesting` 접속 → 케이스 리스트에 다양한 태그와 월별 분포, `exitReason` 기반 표기 정상 렌더링 확인. `aiResult='neutral'` 케이스는 현재 UI에서 win/loss와 동일하게 표시될 수 있음(후속 UI 작업 대상, 본 플랜 out-of-scope).

- [ ] **Step 6: 필요 시 최종 커밋**

변경사항이 남아있다면:
```bash
git add -A
git commit -m "chore: final lint and build verification for multi-signal backtest"
```

---

## 구현 순서 요약

1. **Task 1-3**: 타입·상수·helper export 기반 정비
2. **Task 4-12**: 신규 탐지기 9개 (각 TDD 사이클)
3. **Task 13**: DETECTORS 등록
4. **Task 14-15**: tags·exit 순수 함수 추가 (각 TDD 사이클)
5. **Task 16**: 스크립트 전면 교체
6. **Task 17**: 실제 데이터 생성
7. **Task 18**: 최종 검증

각 탐지기 태스크는 독립적이므로 순서 변경 가능. Task 13은 4-12 완료 후에만 수행. Task 16은 1, 13, 14, 15 모두 완료 후에만 수행.
