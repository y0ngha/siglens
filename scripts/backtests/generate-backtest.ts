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

const FROM_DATE_FETCH = '2024-09-01';
const DISPLAY_START_DATE = '2025-04-01';
const TO_DATE = '2026-04-20';

const OUTPUT_PATH = resolve(process.cwd(), 'src/app/backtesting/data.json');
const MAX_SIGNALS_PER_TICKER = 10;
const MAX_TAGS_PER_CASE = 3;
const MIN_BARS = 120;
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
    // FMP /stable endpoint은 FmpBar[] 를 직접 반환 (newest first).
    // Legacy /api/v3 endpoint은 { historical: FmpBar[] } 형태였으나 /stable로 변경됨.
    const json = (await res.json()) as FmpBar[] | { historical?: FmpBar[] };
    const bars = Array.isArray(json) ? json : (json.historical ?? []);
    return bars.slice().reverse();
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
    let candidates: EntryCandidate[] = [];
    let cooldownUntil = -1;

    if (bars.length < MIN_BARS + 1) return candidates;

    // 시드: MIN_BARS-1 시점 bullish 상태. 없으면 첫 반복에서 phantom confluence 발생
    const seedPrefix = bars.slice(0, MIN_BARS);
    let lastBullishTypes = new Set(
        detectSignals(seedPrefix, calculateIndicators(seedPrefix))
            .filter(s => s.direction === 'bullish')
            .map(s => s.type)
    );

    // O(n²) sweep: 각 bar마다 prefix를 잘라 calculateIndicators + detectSignals 재실행.
    // 운영 코드와 동일한 탐지 로직을 재사용하기 위한 의도적 단순화 (spec 섹션 10.4).
    // n ≈ 400 bars × 10 tickers 수준에서 실측 수분 내 완료.
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
            candidates = [
                ...candidates,
                {
                    idx: i,
                    entryDate,
                    entryPrice: fmpBars[i].close,
                    signalTypes: [...bullishTypes].slice(0, MAX_TAGS_PER_CASE),
                },
            ];
            cooldownUntil = i + HOLD_DAYS;
        }

        lastBullishTypes = bullishTypes;
    }

    // 목업과 일치: 티커당 가장 최근 N개 케이스만 표시 (chronological tail)
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

function isValidEntryRecommendation(v: unknown): v is EntryRecommendation {
    return v === 'enter' || v === 'wait' || v === 'avoid';
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
    const entryRecommendation: EntryRecommendation = isValidEntryRecommendation(rawRec)
        ? rawRec
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
