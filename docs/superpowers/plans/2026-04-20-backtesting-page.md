# Backtesting Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/backtesting` 독립 마케팅 페이지를 만들어 Siglens의 기술적 분석 + AI 예측 신뢰도를 정적 JSON 데이터로 증명한다.

**Architecture:** `src/app/backtesting/data.json`에 사전 계산된 백테스팅 결과를 저장하고, RSC `page.tsx`가 직접 import해 렌더링한다. 티커 탭 필터링만 클라이언트 컴포넌트로 분리한다. 데이터 생성은 `scripts/generate-backtest.ts`를 로컬에서 실행해 JSON을 만든다.

**Tech Stack:** Next.js 16 App Router (RSC), Tailwind CSS 4, TypeScript 5, Anthropic SDK (데이터 생성 스크립트), FMP API (데이터 생성 스크립트)

---

## File Map

| 파일 | 동작 |
|---|---|
| `src/domain/types.ts` | `BacktestCase`, `BacktestData` 타입 추가 |
| `src/domain/backtest/validate.ts` | `validateBacktestData()` — data.json 스키마 검증 순수 함수 |
| `src/__tests__/domain/backtest/validate.test.ts` | validateBacktestData 단위 테스트 |
| `src/app/backtesting/data.json` | 사전 계산된 백테스팅 케이스 (generate-backtest.ts 결과물) |
| `src/app/backtesting/page.tsx` | RSC 페이지 — metadata + 컴포넌트 조립 |
| `src/components/backtesting/BacktestHero.tsx` | 상단 요약 수치 3개 카드 |
| `src/components/backtesting/BacktestTabs.tsx` | 티커 탭 필터 (Client Component) |
| `src/components/backtesting/BacktestCaseCard.tsx` | 개별 케이스 카드 |
| `src/components/backtesting/BacktestCaseList.tsx` | 날짜순 케이스 리스트 (월별 그룹) |
| `src/app/sitemap.ts` | `/backtesting` 항목 추가 |
| `src/app/page.tsx` | 홈페이지 CTA 버튼 추가 |
| `src/lib/seo.ts` | 백테스팅 페이지 SEO 상수 추가 |
| `scripts/generate-backtest.ts` | 로컬 실행용 데이터 생성 스크립트 |
| `worker/src/ai.ts` | `callGeminiScript` 추출 — MAX_TOKENS budget reduction 로직 (config 의존성 없는 순수 export) |

---

## Task 1: 타입 정의

**Files:**
- Modify: `src/domain/types.ts` (파일 맨 끝에 추가)

- [ ] **Step 1: 타입을 domain/types.ts 끝에 추가**

```typescript
// ─── Backtesting ──────────────────────────────────────────────────────────────

export type BacktestSignalResult = 'win' | 'loss';

export interface BacktestCase {
    ticker: string;           // "NVDA"
    entryDate: string;        // "2025-04-11"
    entryPrice: number;       // 98.31
    exitDate: string;         // "2025-04-19"
    exitPrice: number;        // 121.42
    holdingDays: number;      // 8
    returnPct: number;        // 23.5 (양수=수익, 음수=손실)
    signalType: 'buy' | 'sell';
    result: BacktestSignalResult;
    exitReason: 'signal' | 'stop_loss';
    aiResult: BacktestSignalResult; // AI trend 예측의 실제 결과
    aiAnalysis: {
        summary: string;      // AI AnalysisResponse.summary 발췌 (순수 기술적 분석)
        tags: string[];       // indicatorResults에서 추출한 신호 레이블 (최대 3개)
    };
}

export interface BacktestMeta {
    period: string;           // "2025.04 – 2026.04"
    totalCases: number;
    winRate: number;          // 73.2 (퍼센트) — 실제 가격 결과 기반
    aiWinRate: number;        // 68.9 (퍼센트) — AI trend 예측 정확도
    tickerCount: number;
}

export interface BacktestData {
    meta: BacktestMeta;
    cases: BacktestCase[];    // entryDate ASC 정렬
}
```

- [ ] **Step 2: 린트 확인**

```bash
yarn lint
```
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/domain/types.ts
git commit -m "feat: add BacktestCase, BacktestData types to domain/types"
```

---

## Task 2: 스키마 검증 순수 함수 + 테스트

**Files:**
- Create: `src/domain/backtest/validate.ts`
- Create: `src/__tests__/domain/backtest/validate.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/backtest/validate.test.ts`:

```typescript
import { validateBacktestData } from '@/domain/backtest/validate';

describe('validateBacktestData', () => {
    const validCase = {
        ticker: 'NVDA',
        entryDate: '2025-04-11',
        entryPrice: 98.31,
        exitDate: '2025-04-19',
        exitPrice: 121.42,
        holdingDays: 8,
        returnPct: 23.5,
        signalType: 'buy',
        result: 'win',
        exitReason: 'signal',
        aiResult: 'win',
        aiAnalysis: { summary: 'RSI 반등', tags: ['RSI 과매도'] },
    };

    const validData = {
        meta: {
            period: '2025.04 – 2026.04',
            totalCases: 1,
            winRate: 100,
            aiWinRate: 100,
            tickerCount: 1,
        },
        cases: [validCase],
    };

    describe('valid input', () => {
        it('returns data unchanged when input is valid', () => {
            expect(validateBacktestData(validData)).toEqual(validData);
        });
    });

    describe('invalid input', () => {
        it('throws when meta is missing', () => {
            expect(() => validateBacktestData({ cases: [] })).toThrow('meta');
        });

        it('throws when cases is not an array', () => {
            expect(() =>
                validateBacktestData({ ...validData, cases: null })
            ).toThrow('cases');
        });

        it('throws when a case has invalid returnPct type', () => {
            const bad = { ...validData, cases: [{ ...validCase, returnPct: '23.5' }] };
            expect(() => validateBacktestData(bad)).toThrow('returnPct');
        });

        it('throws when result is not win or loss', () => {
            const bad = { ...validData, cases: [{ ...validCase, result: 'maybe' }] };
            expect(() => validateBacktestData(bad)).toThrow('result');
        });

        it('throws when aiAnalysis.tags is not an array', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiAnalysis: { summary: 'x', tags: 'x' } }],
            };
            expect(() => validateBacktestData(bad)).toThrow('tags');
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test src/__tests__/domain/backtest/validate.test.ts
```
Expected: FAIL — "Cannot find module '@/domain/backtest/validate'"

- [ ] **Step 3: 검증 함수 구현**

`src/domain/backtest/validate.ts`:

```typescript
import type { BacktestData } from '@/domain/types';

export function validateBacktestData(data: unknown): BacktestData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('BacktestData must be an object');
    }
    const d = data as Record<string, unknown>;

    if (typeof d['meta'] !== 'object' || d['meta'] === null) {
        throw new Error('meta must be an object');
    }

    if (!Array.isArray(d['cases'])) {
        throw new Error('cases must be an array');
    }

    for (let i = 0; i < (d['cases'] as unknown[]).length; i++) {
        const c = (d['cases'] as unknown[])[i] as Record<string, unknown>;
        if (typeof c['returnPct'] !== 'number') {
            throw new Error(`cases[${i}].returnPct must be a number`);
        }
        if (c['result'] !== 'win' && c['result'] !== 'loss') {
            throw new Error(`cases[${i}].result must be 'win' or 'loss'`);
        }
        if (
            typeof c['aiAnalysis'] !== 'object' ||
            c['aiAnalysis'] === null ||
            !Array.isArray((c['aiAnalysis'] as Record<string, unknown>)['tags'])
        ) {
            throw new Error(`cases[${i}].aiAnalysis.tags must be an array`);
        }
    }

    return data as BacktestData;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test src/__tests__/domain/backtest/validate.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/backtest/validate.ts src/__tests__/domain/backtest/validate.test.ts
git commit -m "feat: add validateBacktestData with tests"
```

---

## Task 3: 데이터 생성 스크립트

**Files:**
- Create: `scripts/generate-backtest.ts`

이 스크립트를 실행하면 `src/app/backtesting/data.json`이 생성된다.
실제 지표 계산 파이프라인(`calculateIndicators` + `buildAnalysisPrompt`)을 사용해
AI의 기술적 분석 결과를 실제 가격 결과와 비교한다.
가짜 commentary를 생성하지 않는다.

### 핵심 흐름

```
FMP bars → Bar[] 변환 → calculateIndicators() → RSI 신호 탐지
  → 신호당: 120봉 컨텍스트 슬라이스 → buildAnalysisPrompt() → Claude API
  → AnalysisResponse.trend ('bullish'|'bearish'|'neutral') → 실제 결과 비교
  → aiResult: AI trend 예측 vs 실제 가격 방향
```

- [ ] **Step 0: `worker/src/ai.ts` 생성 — MAX_TOKENS budget reduction 추출**

`worker/src/gemini.ts`에서 이미 export된 `callGemini`와 `MAX_TOKENS_CODE`를 재사용.
`config`에 의존하지 않도록 apiKey/model을 파라미터로 받는다.

`worker/src/ai.ts`:

```typescript
import { callGemini, MAX_TOKENS_CODE } from './gemini.js';

function isMaxTokensError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === MAX_TOKENS_CODE
    );
}

function getThinkingBudgetSequence(initial: number): number[] {
    const candidates = [initial, Math.floor(initial / 2), 8192, 4096, 2048, 0];
    const result: number[] = [];
    for (const budget of candidates) {
        if (result.length === 0 || budget < result[result.length - 1]) {
            result.push(budget);
        }
    }
    return result;
}

async function callGeminiReducingBudget(
    prompt: string,
    apiKey: string,
    model: string,
    thinkingBudget = 16000,
    signal?: AbortSignal
): Promise<string> {
    const budgets = getThinkingBudgetSequence(thinkingBudget);
    for (const budget of budgets) {
        try {
            return await callGemini(prompt, {
                apiKey,
                model,
                thinking: budget > 0,
                thinkingBudget: budget,
                signal,
            });
        } catch (error) {
            if (isMaxTokensError(error)) {
                const idx = budgets.indexOf(budget);
                const next = budgets[idx + 1];
                if (next !== undefined) {
                    console.warn(
                        `[ai] MAX_TOKENS (thinkingBudget=${budget}). Retrying with budget=${next}.`
                    );
                    continue;
                }
                throw error;
            }
            throw error;
        }
    }
    throw new Error('All thinking budget steps exhausted');
}

/**
 * config 의존성 없이 apiKey/model을 직접 받는다.
 * 스크립트(generate-backtest.ts) 전용 export.
 */
export async function callGeminiScript(
    prompt: string,
    apiKey: string,
    model: string,
    signal?: AbortSignal
): Promise<string> {
    return callGeminiReducingBudget(prompt, apiKey, model, 16000, signal);
}
```

```bash
# 타입 확인
npx tsc --noEmit -p worker/tsconfig.json
```
Expected: 에러 없음

- [ ] **Step 1: 스크립트 작성**

`scripts/generate-backtest.ts`:

```typescript
/**
 * 백테스팅 데이터 생성 스크립트
 *
 * 사용법:
 *   npx tsx scripts/generate-backtest.ts
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY           — Financial Modeling Prep API 키
 *   GEMINI_FREE_API_KEY   — Google AI Studio 무료 API 키 (Gemini 2.5 Flash-lite)
 *
 * 출력: src/app/backtesting/data.json
 *
 * Rate limit 전략:
 *   - Gemini 2.5 Flash-lite free tier: ~15 RPM → 호출 간 5초 sleep
 *   - 429/5xx: worker/src/retry.ts의 withRetry 재사용 (exponential backoff: 5s, 10s, 20s)
 *   - FMP free tier: 250 calls/day → 호출 간 1초 sleep
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { calculateIndicators } from '../src/domain/indicators/index.js';
import { buildAnalysisPrompt } from '../src/domain/analysis/prompt.js';
import { enrichAnalysisWithConfidence } from '../src/domain/analysis/confidence.js';
import { parseJsonResponse } from '../src/infrastructure/ai/utils.js';
import { callGeminiScript } from '../worker/src/ai.js';
import type { Bar, RawAnalysisResponse } from '../src/domain/types.js';

config({ path: resolve(process.cwd(), '.env.local') });

// ─── 설정 ──────────────────────────────────────────────────────────────────────

const TICKERS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'PLTR', 'CRWD', 'MSTR',
];

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_API_KEY = process.env.FMP_API_KEY ?? '';
const GEMINI_FREE_API_KEY = process.env.GEMINI_FREE_API_KEY ?? '';
const FROM_DATE = '2025-04-01';
const TO_DATE = '2026-04-20';
const OUTPUT_PATH = resolve(process.cwd(), 'src/app/backtesting/data.json');
const MAX_SIGNALS_PER_TICKER = 10;
const HOLD_DAYS = 10;
const CONTEXT_BARS = 120;

// Gemini 2.5 Flash-lite free tier: ~15 RPM → 5초 간격
const GEMINI_SLEEP_MS = 5_000;
// FMP free tier: 5 calls/min 안전선
const FMP_SLEEP_MS = 1_000;
// 429 재시도 최대 횟수
const MAX_RETRIES = 5;
// retry-after를 파싱하지 못했을 때의 기본 대기 시간
const DEFAULT_RETRY_AFTER_MS = 60_000;
// 모델명
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

if (!FMP_API_KEY) throw new Error('FMP_API_KEY is required in .env.local');
if (!GEMINI_FREE_API_KEY) throw new Error('GEMINI_FREE_API_KEY is required in .env.local');

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ─── FMP bars 조회 ─────────────────────────────────────────────────────────────

interface FmpBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

async function fetchDailyBars(ticker: string): Promise<FmpBar[]> {
    const url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${ticker}&from=${FROM_DATE}&to=${TO_DATE}&apikey=${FMP_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FMP fetch failed for ${ticker}: ${res.status}`);
    const json = await res.json() as { historical?: FmpBar[] };
    return (json.historical ?? []).slice().reverse(); // oldest→newest (ASC)
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

// ─── RSI 신호 탐지 ─────────────────────────────────────────────────────────────

function calcRsiSimple(closes: number[], period = 14): number[] {
    const rsi: number[] = new Array(closes.length).fill(50);
    for (let i = period; i < closes.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const diff = closes[j] - closes[j - 1];
            if (diff > 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) { rsi[i] = 100; continue; }
        rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
    return rsi;
}

interface SignalPoint { idx: number; entryDate: string; entryPrice: number }

function detectBuySignals(fmpBars: FmpBar[]): SignalPoint[] {
    const rsi = calcRsiSimple(fmpBars.map(b => b.close));
    const signals: SignalPoint[] = [];
    for (let i = 15; i < fmpBars.length - HOLD_DAYS - 1; i++) {
        if (rsi[i - 1] < 30 && rsi[i] >= 30) {
            signals.push({ idx: i, entryDate: fmpBars[i].date, entryPrice: fmpBars[i].close });
        }
    }
    return signals;
}

// ─── Gemini 호출 — retry-after 직접 파싱 ──────────────────────────────────────
//
// Google Gemini API 429 에러 응답에는 retry-after 정보가 여러 위치에 있을 수 있다:
//   1. HTTP 헤더: retry-after (초)
//   2. 에러 바디: details[].retryDelay = "30s" 형식
//   3. 에러 메시지에 포함된 숫자 패턴
// 파싱 실패 시 DEFAULT_RETRY_AFTER_MS(60초) 사용.

function parseRetryAfterMs(err: unknown): number {
    const msg = err instanceof Error ? err.message : String(err);

    // "retryDelay":"30s" 또는 "retryDelay": "30s" 형식
    const delayMatch = /"retryDelay"\s*:\s*"(\d+)s"/i.exec(msg);
    if (delayMatch) return parseInt(delayMatch[1], 10) * 1000;

    // "retry-after: 30" 또는 "Retry-After: 30" 형식
    const headerMatch = /retry-after[:\s]+(\d+)/i.exec(msg);
    if (headerMatch) return parseInt(headerMatch[1], 10) * 1000;

    // 에러 객체에 headers 프로퍼티가 있는 경우 (SDK가 노출하는 경우)
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
        const status = (err as Record<string, unknown>).status;
        if (status === 429) return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('429') || /resource.?exhausted/i.test(msg);
}

async function callGeminiWithRetryAfter(prompt: string): Promise<string> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // callGeminiScript: MAX_TOKENS budget reduction 포함 (thinking budget 단계적 감소)
            return await callGeminiScript(prompt, GEMINI_FREE_API_KEY, GEMINI_MODEL);
        } catch (err) {
            if (is429(err) && attempt < MAX_RETRIES) {
                const waitMs = parseRetryAfterMs(err);
                console.log(`  [429] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${waitMs / 1000}s...`);
                await sleep(waitMs + 500); // +0.5초 여유
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}

// ─── AI 분석 ───────────────────────────────────────────────────────────────────

async function runAiAnalysis(
    ticker: string,
    bars: Bar[],
    entryIdx: number,
): Promise<{ trend: 'bullish' | 'bearish' | 'neutral'; summary: string; tags: string[] }> {
    const contextBars = bars.slice(Math.max(0, entryIdx - CONTEXT_BARS + 1), entryIdx + 1);
    const indicators = calculateIndicators(contextBars);
    const prompt = buildAnalysisPrompt(ticker, contextBars, indicators, [], '1Day');

    const text = await callGeminiWithRetryAfter(prompt);

    const raw = parseJsonResponse<RawAnalysisResponse>(text, 'analysis');
    const result = enrichAnalysisWithConfidence(raw, []);

    const tags: string[] = result.indicatorResults
        .flatMap(ir => ir.signals.map(s => `${ir.indicatorName} ${s.description}`))
        .slice(0, 3);

    return {
        trend: result.trend,
        summary: (result.summary ?? '').slice(0, 150),
        tags,
    };
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
    type CaseItem = {
        ticker: string; entryDate: string; entryPrice: number;
        exitDate: string; exitPrice: number; holdingDays: number;
        returnPct: number; signalType: 'buy' | 'sell'; result: 'win' | 'loss';
        exitReason: 'signal' | 'stop_loss'; aiResult: 'win' | 'loss';
        aiAnalysis: { summary: string; tags: string[] };
    };
    const allCases: CaseItem[] = [];

    for (const ticker of TICKERS) {
        console.log(`\n[${ticker}] Fetching bars...`);
        const fmpBars = await fetchDailyBars(ticker);
        await sleep(FMP_SLEEP_MS);

        if (fmpBars.length < 30) { console.log(`  Skipping — not enough bars`); continue; }

        const bars = toBarArray(fmpBars);
        const signals = detectBuySignals(fmpBars);
        const selected = signals.slice(0, MAX_SIGNALS_PER_TICKER);
        console.log(`  Found ${signals.length} signals → using ${selected.length}`);

        for (const sig of selected) {
            const exitIdx = Math.min(sig.idx + HOLD_DAYS, fmpBars.length - 1);
            const exitBar = fmpBars[exitIdx];
            const returnPct = ((exitBar.close - sig.entryPrice) / sig.entryPrice) * 100;
            const result: 'win' | 'loss' = returnPct >= 0 ? 'win' : 'loss';

            console.log(`  ${sig.entryDate} → ${exitBar.date} | ${returnPct.toFixed(1)}% (${result})`);

            const ai = await runAiAnalysis(ticker, bars, sig.idx);

            const aiResult: 'win' | 'loss' =
                (ai.trend === 'bullish' && returnPct > 0) ||
                (ai.trend === 'bearish' && returnPct < 0)
                    ? 'win' : 'loss';

            allCases.push({
                ticker,
                entryDate: sig.entryDate,
                entryPrice: sig.entryPrice,
                exitDate: exitBar.date,
                exitPrice: exitBar.close,
                holdingDays: exitIdx - sig.idx,
                returnPct: Number(returnPct.toFixed(2)),
                signalType: 'buy',
                result,
                exitReason: 'signal',
                aiResult,
                aiAnalysis: { summary: ai.summary, tags: ai.tags },
            });

            // Gemini free tier rate limit 방지: 5초 sleep
            await sleep(GEMINI_SLEEP_MS);
        }
    }

    allCases.sort((a, b) => a.entryDate.localeCompare(b.entryDate));

    const wins = allCases.filter(c => c.result === 'win').length;
    const aiWins = allCases.filter(c => c.aiResult === 'win').length;
    const total = allCases.length;

    const output = {
        meta: {
            period: '2025.04 – 2026.04',
            totalCases: total,
            winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
            aiWinRate: total > 0 ? Number(((aiWins / total) * 100).toFixed(1)) : 0,
            tickerCount: TICKERS.length,
        },
        cases: allCases,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n✓ Saved ${total} cases to ${OUTPUT_PATH}`);
    console.log(`  Signal win rate: ${output.meta.winRate}%`);
    console.log(`  AI win rate: ${output.meta.aiWinRate}%`);
    console.log(`  Estimated time: ~${Math.ceil(total * GEMINI_SLEEP_MS / 60000)}min`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: 스크립트 실행 (실제 데이터 생성)**

```bash
npx tsx scripts/generate-backtest.ts
```
Expected: `✓ Saved N cases to src/app/backtesting/data.json`

> **주의:** 실행에 수 분 소요. FMP_API_KEY, ANTHROPIC_API_KEY가 .env.local에 있어야 함.

- [ ] **Step 3: 생성된 JSON 검증**

```bash
node -e "
const d = require('./src/app/backtesting/data.json');
console.log('cases:', d.cases.length, '| winRate:', d.meta.winRate + '% | aiWinRate:', d.meta.aiWinRate + '%');
console.log('first case:', JSON.stringify(d.cases[0], null, 2));
"
```
Expected: cases 수 출력, 첫 케이스 JSON 출력 (aiAnalysis.summary가 한국어 기술적 분석 텍스트)

- [ ] **Step 4: 커밋**

```bash
git add scripts/generate-backtest.ts src/app/backtesting/data.json
git commit -m "feat: add backtest data generation script and generated data.json"
```

---

## Task 4: SEO 상수 추가

**Files:**
- Modify: `src/lib/seo.ts`

> **SEO 감사 수정:** `BACKTESTING_TITLE`에서 `| ${SITE_NAME}` 제거.
> Root layout의 `title.template: '%s | Siglens'`가 자동으로 브랜드를 붙이므로 중복 방지.

- [ ] **Step 1: SEO 상수 추가**

`src/lib/seo.ts` 파일 끝에 추가:

```typescript
export const BACKTESTING_PATH = '/backtesting';
export const BACKTESTING_URL = `${SITE_URL}${BACKTESTING_PATH}`;
// Root layout template이 "| Siglens"를 자동 추가하므로 브랜드명 제외
export const BACKTESTING_TITLE = 'AI 기술적 분석 백테스팅 결과';
// 기존 SEO 텍스트 스타일 준수: 구체적 숫자, 사용자 행동 중심, 짧고 명확한 문장
export const BACKTESTING_DESCRIPTION =
    'AAPL·NVDA·TSLA 등 10개 종목을 1년간 실제 분석한 백테스팅 케이스입니다. RSI·MACD·Supertrend 기술적 신호와 AI 예측이 실제로 얼마나 맞았는지 데이터로 직접 확인하세요.';
export const BACKTESTING_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '주식 AI 백테스팅',
    '기술적 분석 백테스팅',
    'AI 주식 예측 정확도',
    '주식 기술적 분석 정확도',
    'RSI 신호 백테스팅',
    'MACD 백테스팅',
    'AI 분석 신뢰도',
    'Magnificent 7 분석',
];
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/seo.ts
git commit -m "feat: add backtesting SEO constants"
```

---

## Task 5: BacktestCaseCard 컴포넌트

**Files:**
- Create: `src/components/backtesting/BacktestCaseCard.tsx`

> **디자인 시스템 수정 (frontend-design + web-design-guidelines 감사):**
> - `text-green-400` → `text-chart-bullish`, `text-red-400` → `text-chart-bearish`
> - `border-green-900/60` → `border-chart-bullish/20`, `border-red-900/60` → `border-chart-bearish/20`
> - `bg-green-950/40` → `bg-chart-bullish/10`, `bg-red-950/40` → `bg-chart-bearish/10`
> - `dangerouslySetInnerHTML` 제거 → `summary` 일반 텍스트로 렌더링
> - 숫자에 `tabular-nums` 적용
> - ✓/✗ 아이콘에 `aria-hidden` + sr-only 텍스트 추가
> - `article`에 sr-only heading 추가
> - 티커 badge에 `translate="no"` 추가 (NVDA, AAPL 등 식별자 번역 방지)
> - `$price` 표시에 `Intl.NumberFormat` 사용 (가이드라인: Numbers/currency)
> - AI summary `<p>`에 `line-clamp-3` 추가 (긴 텍스트 오버플로우 방지)

- [ ] **Step 1: 컴포넌트 작성**

`src/components/backtesting/BacktestCaseCard.tsx`:

```tsx
import type { BacktestCase } from '@/domain/types';

interface BacktestCaseCardProps {
    case_: BacktestCase;
}

const priceFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function BacktestCaseCard({ case_: c }: BacktestCaseCardProps) {
    const isWin = c.result === 'win';
    const returnLabel = `${c.returnPct >= 0 ? '+' : ''}${c.returnPct.toFixed(1)}%`;

    return (
        <article
            aria-label={`${c.ticker} ${c.entryDate} ${isWin ? '수익' : '손실'} ${returnLabel}`}
            className={`rounded-lg border p-3 ${
                isWin
                    ? 'border-secondary-700 bg-secondary-800/50'
                    : 'border-chart-bearish/20 bg-secondary-800/50'
            }`}
        >
            {/* Header: 티커 + 타임라인 + 수익률 */}
            <div className="mb-2 flex items-center gap-2">
                {/* translate="no": 티커는 번역 금지 식별자 */}
                <span
                    translate="no"
                    className={`rounded px-2 py-0.5 text-xs font-bold ${
                        isWin
                            ? 'bg-secondary-700 text-primary-400'
                            : 'bg-chart-bearish/10 text-chart-bearish'
                    }`}
                >
                    {c.ticker}
                </span>

                {/* 타임라인 */}
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs">
                    <div className="shrink-0 rounded border border-chart-bullish/20 bg-chart-bullish/10 px-2 py-1">
                        <span className="font-semibold text-chart-bullish">매수</span>
                        <span className="text-secondary-400 ml-1">{c.entryDate}</span>
                        <span className="ml-1 font-mono tabular-nums text-secondary-500">
                            {priceFormatter.format(c.entryPrice)}
                        </span>
                    </div>
                    <span className="text-secondary-600 shrink-0" aria-hidden="true">→</span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-secondary-500">
                        <span className="tabular-nums">{c.holdingDays}</span>일
                    </span>
                    <span className="text-secondary-600 shrink-0" aria-hidden="true">→</span>
                    <div className="shrink-0 rounded border border-chart-bearish/20 bg-chart-bearish/10 px-2 py-1 text-right">
                        <span className="font-semibold text-chart-bearish">
                            {c.exitReason === 'stop_loss' ? '손절' : '매도'}
                        </span>
                        <span className="text-secondary-400 ml-1">{c.exitDate}</span>
                        <span className="ml-1 font-mono tabular-nums text-secondary-500">
                            {priceFormatter.format(c.exitPrice)}
                        </span>
                    </div>
                </div>

                {/* 수익률 + 결과 아이콘 */}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                            isWin ? 'text-chart-bullish' : 'text-chart-bearish'
                        }`}
                    >
                        {returnLabel}
                    </span>
                    <span
                        aria-hidden="true"
                        className={`text-xs ${isWin ? 'text-chart-bullish' : 'text-chart-bearish'}`}
                    >
                        {isWin ? '✓' : '✗'}
                    </span>
                    <span className="sr-only">{isWin ? '수익' : '손실'}</span>
                </div>
            </div>

            {/* AI 분석 발췌 — 순수 텍스트 렌더링 (dangerouslySetInnerHTML 금지) */}
            {/* line-clamp-3: 긴 AI 요약 오버플로우 방지 */}
            <p
                className={`line-clamp-3 rounded-r px-3 py-2 text-[11px] leading-relaxed text-secondary-400 ${
                    isWin
                        ? 'border-l-2 border-chart-bullish bg-black/20'
                        : 'border-l-2 border-ui-warning bg-black/20'
                }`}
            >
                {c.aiAnalysis.summary}
            </p>

            {/* 태그 */}
            {c.aiAnalysis.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.aiAnalysis.tags.map(tag => (
                        <span
                            key={tag}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                                isWin
                                    ? 'border border-primary-900/50 bg-primary-950/40 text-primary-400'
                                    : 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
                            }`}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </article>
    );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/backtesting/BacktestCaseCard.tsx
git commit -m "feat: add BacktestCaseCard component"
```

---

## Task 6: BacktestCaseList 컴포넌트

**Files:**
- Create: `src/components/backtesting/BacktestCaseList.tsx`

월별 구분선으로 케이스 카드를 그룹핑해 렌더링한다. Server Component.

- [ ] **Step 1: 컴포넌트 작성**

`src/components/backtesting/BacktestCaseList.tsx`:

```tsx
import type { BacktestCase } from '@/domain/types';
import { BacktestCaseCard } from './BacktestCaseCard';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

function getMonthLabel(dateStr: string): string {
    const [year, month] = dateStr.split('-');
    return `${year}년 ${parseInt(month, 10)}월`;
}

export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    if (cases.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-secondary-500">
                해당 종목의 케이스가 없습니다.
            </p>
        );
    }

    // 월별 그룹핑 — entryDate ASC 정렬은 data.json이 이미 보장
    const groups: Array<{ label: string; items: BacktestCase[] }> = [];
    for (const c of cases) {
        const label = getMonthLabel(c.entryDate);
        const last = groups[groups.length - 1];
        if (!last || last.label !== label) {
            groups.push({ label, items: [c] });
        } else {
            last.items.push(c);
        }
    }

    return (
        <div className="flex flex-col gap-2 px-4 pb-6">
            {groups.map(group => (
                <div key={group.label}>
                    <div className="pb-1 pt-3 text-[10px] uppercase tracking-widest text-secondary-600">
                        {group.label}
                    </div>
                    <div className="flex flex-col gap-2">
                        {group.items.map((c, i) => (
                            <BacktestCaseCard key={`${c.ticker}-${c.entryDate}-${i}`} case_={c} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/backtesting/BacktestCaseList.tsx
git commit -m "feat: add BacktestCaseList component with monthly grouping"
```

---

## Task 7: BacktestTabs 컴포넌트 (Client)

**Files:**
- Create: `src/components/backtesting/BacktestTabs.tsx`

티커 탭 + 케이스 필터링을 담당하는 유일한 Client Component.

> **접근성 수정 (web-design-guidelines 감사):**
> - `role="tablist"` + 각 탭에 `role="tab"`, `aria-selected`, `aria-controls` 추가
> - 키보드 내비게이션: Left/Right 화살표로 탭 이동 (WAI-ARIA tablist 패턴)
> - `focus-visible:ring-2 focus-visible:ring-primary-400` 추가
> - URL searchParams에 활성 탭 상태 반영 (`?ticker=NVDA`)
>   — 딥링크 공유 가능, 뒤로가기 시 필터 복원

- [ ] **Step 1: 컴포넌트 작성**

`src/components/backtesting/BacktestTabs.tsx`:

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BacktestCase } from '@/domain/types';
import { BacktestCaseList } from './BacktestCaseList';

interface BacktestTabsProps {
    cases: BacktestCase[];
    tickers: string[];
}

const ALL_TAB = '전체';

export function BacktestTabs({ cases, tickers }: BacktestTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabs = [ALL_TAB, ...tickers];

    const active = searchParams.get('ticker') ?? ALL_TAB;
    // 유효하지 않은 ticker 파라미터 방어
    const safeActive = tabs.includes(active) ? active : ALL_TAB;

    const filtered =
        safeActive === ALL_TAB ? cases : cases.filter(c => c.ticker === safeActive);

    const setActive = useCallback(
        (tab: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (tab === ALL_TAB) {
                params.delete('ticker');
            } else {
                params.set('ticker', tab);
            }
            router.push(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const currentIdx = tabs.indexOf(safeActive);
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setActive(tabs[(currentIdx + 1) % tabs.length]);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setActive(tabs[(currentIdx - 1 + tabs.length) % tabs.length]);
            } else if (e.key === 'Home') {
                e.preventDefault();
                setActive(tabs[0]);
            } else if (e.key === 'End') {
                e.preventDefault();
                setActive(tabs[tabs.length - 1]);
            }
        },
        [safeActive, tabs, setActive]
    );

    return (
        <div>
            {/* 탭 바 */}
            <div
                role="tablist"
                aria-label="티커 필터"
                onKeyDown={handleKeyDown}
                className="overflow-x-auto border-b border-secondary-800"
            >
                <div className="flex min-w-max px-4">
                    {tabs.map(tab => {
                        const isSelected = tab === safeActive;
                        return (
                            <button
                                key={tab}
                                role="tab"
                                aria-selected={isSelected}
                                aria-controls="backtest-case-list"
                                tabIndex={isSelected ? 0 : -1}
                                onClick={() => setActive(tab)}
                                style={{ touchAction: 'manipulation' }}
                                className={`cursor-pointer border-b-2 px-3.5 py-2.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 focus-visible:ring-offset-secondary-900 ${
                                    isSelected
                                        ? 'border-primary-400 text-primary-400'
                                        : 'border-transparent text-secondary-500 hover:text-secondary-300'
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 케이스 리스트 */}
            <div
                id="backtest-case-list"
                role="tabpanel"
                aria-label={`${safeActive} 케이스 목록`}
            >
                <BacktestCaseList cases={filtered} />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/backtesting/BacktestTabs.tsx
git commit -m "feat: add BacktestTabs client component with a11y and URL state"
```

---

## Task 8: BacktestHero 컴포넌트

**Files:**
- Create: `src/components/backtesting/BacktestHero.tsx`

> **디자인 시스템 수정 (frontend-design + web-design-guidelines 감사):**
> - StatCard `color` prop 제거 → 직접 디자인 토큰 사용
> - 수치에 `tabular-nums` 적용

- [ ] **Step 1: 컴포넌트 작성**

`src/components/backtesting/BacktestHero.tsx`:

```tsx
import type { BacktestMeta } from '@/domain/types';

interface BacktestHeroProps {
    meta: BacktestMeta;
}

interface StatCardProps {
    value: string;
    label: string;
    valueClassName: string;
}

function StatCard({ value, label, valueClassName }: StatCardProps) {
    return (
        <div className="text-center">
            <div className={`font-mono text-lg font-bold tabular-nums ${valueClassName}`}>
                {value}
            </div>
            <div className="mt-0.5 text-[10px] text-secondary-500">{label}</div>
        </div>
    );
}

export function BacktestHero({ meta }: BacktestHeroProps) {
    return (
        <header className="border-b border-secondary-800 px-6 py-6 text-center">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-secondary-500">
                BACKTESTING RESULTS · {meta.period}
            </p>
            {/* text-balance: 헤딩 줄 균형 (가이드라인: text-wrap: balance on headings) */}
            <h1 className="mb-5 text-balance text-xl font-bold text-secondary-100">
                Siglens가 얼마나 정확한가요?
            </h1>
            <div className="inline-flex items-center gap-5 rounded-lg border border-secondary-700 bg-secondary-800/40 px-6 py-3">
                <StatCard
                    value={`${meta.winRate}%`}
                    label="지표 신호 승률"
                    valueClassName="text-chart-bullish"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.aiWinRate}%`}
                    label="AI 예측 승률"
                    valueClassName="text-primary-400"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.totalCases}개`}
                    label="총 케이스"
                    valueClassName="text-ui-warning"
                />
                <div className="h-8 w-px bg-secondary-700" aria-hidden="true" />
                <StatCard
                    value={`${meta.tickerCount}종목`}
                    label="Mag7 + 선도주"
                    valueClassName="text-secondary-300"
                />
            </div>
        </header>
    );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/backtesting/BacktestHero.tsx
git commit -m "feat: add BacktestHero component"
```

---

## Task 9: /backtesting 페이지

**Files:**
- Create: `src/app/backtesting/page.tsx`

> **SEO 감사 수정:**
> - `metadata.title`을 `{ absolute: ... }` 형식으로 → Root layout template 중복 방지
> - `openGraph.images` 명시적 포함
> - `WebPage` + `Dataset` JSON-LD 추가
> - `bg-primary` → `bg-secondary-900`

- [ ] **Step 1: 페이지 작성**

`src/app/backtesting/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    BACKTESTING_DESCRIPTION,
    BACKTESTING_KEYWORDS,
    BACKTESTING_TITLE,
    BACKTESTING_URL,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { BacktestHero } from '@/components/backtesting/BacktestHero';
import { BacktestTabs } from '@/components/backtesting/BacktestTabs';
import backtestData from './data.json';
import type { BacktestData } from '@/domain/types';

const data = backtestData as unknown as BacktestData;
const TICKERS = [...new Set(data.cases.map(c => c.ticker))];

// title.absolute: Root layout의 template("%s | Siglens")을 우회해 중복 방지
export const metadata: Metadata = {
    title: { absolute: `${BACKTESTING_TITLE} | ${SITE_NAME}` },
    description: BACKTESTING_DESCRIPTION,
    keywords: BACKTESTING_KEYWORDS,
    alternates: { canonical: BACKTESTING_URL },
    openGraph: {
        title: `${BACKTESTING_TITLE} | ${SITE_NAME}`,
        description: BACKTESTING_DESCRIPTION,
        url: BACKTESTING_URL,
        siteName: SITE_NAME,
        locale: 'ko_KR',
        type: 'website',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: `${SITE_NAME} AI 백테스팅 결과`,
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: `${BACKTESTING_TITLE} | ${SITE_NAME}`,
        description: BACKTESTING_DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${BACKTESTING_TITLE} | ${SITE_NAME}`,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
};

const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${SITE_NAME} AI 기술적 분석 백테스팅 데이터셋`,
    description: BACKTESTING_DESCRIPTION,
    url: BACKTESTING_URL,
    creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    temporalCoverage: '2025-04/2026-04',
    spatialCoverage: 'US',
    variableMeasured: '주식 기술적 분석 신호 승률 및 AI 예측 정확도',
};

export default function BacktestingPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
            />
            <div className="min-h-screen bg-secondary-900">
                <BacktestHero meta={data.meta} />
                <main>
                    {/* BacktestTabs는 useSearchParams를 사용하므로 Suspense로 감싼다 */}
                    <Suspense fallback={<div className="py-10 text-center text-sm text-secondary-500">로딩 중...</div>}>
                        <BacktestTabs cases={data.cases} tickers={TICKERS} />
                    </Suspense>
                </main>
                <footer className="border-t border-secondary-800 px-6 py-4">
                    <p className="text-center text-[11px] text-secondary-600">
                        * 본 결과는 과거 데이터 기반 백테스팅이며 미래 수익을 보장하지 않습니다.
                        투자 판단의 책임은 투자자 본인에게 있습니다.
                    </p>
                </footer>
            </div>
        </>
    );
}
```

> **주의:** `useSearchParams()`를 사용하는 컴포넌트는 반드시 `<Suspense>`로 감싸야 Next.js 16 빌드가 통과된다.

- [ ] **Step 2: 빌드 확인**

```bash
yarn build
```
Expected: 빌드 성공 (에러 없음)

- [ ] **Step 3: 개발 서버에서 확인**

```bash
yarn dev
```
브라우저에서 `http://localhost:4200/backtesting` 접속 → 페이지 렌더링 확인

- [ ] **Step 4: 커밋**

```bash
git add src/app/backtesting/page.tsx
git commit -m "feat: add /backtesting page with SEO metadata and JSON-LD"
```

---

## Task 10: sitemap.ts 업데이트

**Files:**
- Modify: `src/app/sitemap.ts`

> **SEO 감사 수정:** `/backtesting`은 마케팅 랜딩 페이지이므로 `priority: 0.9`

- [ ] **Step 1: /backtesting 항목 추가**

`src/app/sitemap.ts`의 `/market` 항목 바로 뒤에 추가:

```typescript
{
    url: `${SITE_URL}/backtesting`,
    lastModified: SITEMAP_DATE,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
},
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/sitemap.ts
git commit -m "feat: add /backtesting to sitemap with priority 0.9"
```

---

## Task 11: 홈페이지 CTA 추가

**Files:**
- Modify: `src/app/page.tsx`

홈페이지에서 `/backtesting`으로 이동하는 CTA 버튼 1개를 추가한다.

- [ ] **Step 1: page.tsx에서 적절한 위치 파악**

`src/app/page.tsx`를 열어 `HowItWorks` 컴포넌트가 렌더링되는 위치 확인.
CTA는 `HowItWorks` 섹션 바로 아래에 추가한다.

- [ ] **Step 2: Link import 추가 및 CTA 삽입**

`src/app/page.tsx`의 import 목록에 `Link`가 없다면 추가 (Next.js Link는 이미 있을 가능성 높음).

`<HowItWorks ... />` 아래에 다음 JSX 추가:

```tsx
<section className="px-6 pb-8 lg:px-[15vw]">
    <div className="flex flex-col items-center gap-3 rounded-lg border border-secondary-800 bg-secondary-800/30 px-6 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
            <p className="text-sm font-semibold text-secondary-200">
                Siglens는 얼마나 정확할까요?
            </p>
            <p className="mt-0.5 text-xs text-secondary-500">
                1년간 10개 종목 기술적 분석 + AI 예측 백테스팅 결과를 확인하세요.
            </p>
        </div>
        <Link
            href="/backtesting"
            className="shrink-0 rounded-md bg-secondary-700 px-4 py-2 text-xs font-medium text-secondary-200 transition-colors hover:bg-secondary-600"
        >
            백테스팅 결과 보기 →
        </Link>
    </div>
</section>
```

- [ ] **Step 3: 개발 서버에서 홈페이지 확인**

`http://localhost:4200` 접속 → CTA 배너 렌더링 확인 → 클릭 시 `/backtesting` 이동 확인

- [ ] **Step 4: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: add backtesting CTA banner to homepage"
```

---

## Task 12: 최종 확인 및 린트

- [ ] **Step 1: 전체 린트**

```bash
yarn lint && yarn lint:style
```
Expected: 에러 없음

- [ ] **Step 2: 전체 테스트**

```bash
yarn test
```
Expected: validate.test.ts 포함 전체 PASS

- [ ] **Step 3: 프로덕션 빌드**

```bash
yarn build
```
Expected: 빌드 성공. `/backtesting` 정적 페이지 생성 확인

- [ ] **Step 4: 최종 커밋 (필요 시)**

변경사항이 남아있다면:
```bash
git add -A
git commit -m "chore: final lint and build verification for backtesting page"
```
