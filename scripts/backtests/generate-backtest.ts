/**
 * 백테스팅 데이터 생성 스크립트
 *
 * 사용법: npx tsx scripts/generate-backtest.ts
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY           — Financial Modeling Prep API 키
 *   GEMINI_FREE_API_KEY   — Google AI Studio 무료 API 키 (Gemini 2.5 Flash-lite)
 *
 * 출력: src/app/backtesting/data.json
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { calculateIndicators } from '@/domain/indicators';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import { parseJsonResponse } from '@/infrastructure/ai/utils';
import { callGeminiScript } from './ai.js';
import type { Bar, RawAnalysisResponse, BacktestOutcome } from '@/domain/types';

config({ path: resolve(process.cwd(), '.env.local') });

const TICKERS = [
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'NVDA',
    'META',
    'TSLA',
    'PLTR',
    'CRWD',
    'MSTR',
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

// Simplified RSI for signal detection only. Uses simple (non-smoothed) averages
// intentionally — the production pipeline (calculateIndicators) uses Wilder smoothing,
// which is used later for the full AI analysis prompt, not for signal detection.
function calcRsiSimple(closes: number[], period = 14): number[] {
    const rsi: number[] = new Array(closes.length).fill(50);
    for (let i = period; i < closes.length; i++) {
        let gains = 0,
            losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const diff = closes[j] - closes[j - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) {
            rsi[i] = 100;
            continue;
        }
        rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
    return rsi;
}

interface SignalPoint {
    idx: number;
    entryDate: string;
    entryPrice: number;
}

function detectBuySignals(fmpBars: FmpBar[]): SignalPoint[] {
    const rsi = calcRsiSimple(fmpBars.map(b => b.close));
    const signals: SignalPoint[] = [];
    for (let i = 15; i < fmpBars.length - HOLD_DAYS - 1; i++) {
        if (rsi[i - 1] < 30 && rsi[i] >= 30) {
            signals.push({
                idx: i,
                entryDate: fmpBars[i].date,
                entryPrice: fmpBars[i].close,
            });
        }
    }
    return signals;
}

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

async function runAiAnalysis(
    ticker: string,
    bars: Bar[],
    entryIdx: number
): Promise<{
    trend: 'bullish' | 'bearish' | 'neutral';
    summary: string;
    tags: string[];
}> {
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
    const tags: string[] = result.indicatorResults
        .flatMap(ir =>
            ir.signals.map(s => `${ir.indicatorName} ${s.description}`)
        )
        .slice(0, 3);
    return {
        trend: result.trend,
        summary: (result.summary ?? '').slice(0, 150),
        tags,
    };
}

async function main() {
    let allCases: BacktestCase[] = [];

    for (const ticker of TICKERS) {
        console.log(`\n[${ticker}] Fetching bars...`);
        const fmpBars = await fetchDailyBars(ticker);
        await sleep(FMP_SLEEP_MS);
        if (fmpBars.length < 30) {
            console.log(`  Skipping — not enough bars`);
            continue;
        }
        const bars = toBarArray(fmpBars);
        const signals = detectBuySignals(fmpBars);
        const selected = signals.slice(0, MAX_SIGNALS_PER_TICKER);
        console.log(
            `  Found ${signals.length} signals → using ${selected.length}`
        );

        for (const sig of selected) {
            const exitIdx = Math.min(sig.idx + HOLD_DAYS, fmpBars.length - 1);
            const exitBar = fmpBars[exitIdx];
            const returnPct =
                ((exitBar.close - sig.entryPrice) / sig.entryPrice) * 100;
            const result: BacktestOutcome = returnPct >= 0 ? 'win' : 'loss';
            console.log(
                `  ${sig.entryDate} → ${exitBar.date} | ${returnPct.toFixed(1)}% (${result})`
            );

            const ai = await runAiAnalysis(ticker, bars, sig.idx);

            // aiResult: AI의 bullish/bearish 예측이 실제 가격 방향과 일치했는지 여부
            const aiResult: BacktestOutcome =
                (ai.trend === 'bullish' && returnPct > 0) ||
                (ai.trend === 'bearish' && returnPct < 0)
                    ? 'win'
                    : 'loss';

            allCases = [
                ...allCases,
                {
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
                },
            ];

            await sleep(GEMINI_SLEEP_MS);
        }
    }

    const sortedCases = [...allCases].sort((a, b) =>
        a.entryDate.localeCompare(b.entryDate)
    );

    const wins = sortedCases.filter(c => c.result === 'win').length;
    const aiWins = sortedCases.filter(c => c.aiResult === 'win').length;
    const total = sortedCases.length;

    const output = {
        meta: {
            period: '2025.04 – 2026.04',
            totalCases: total,
            winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
            aiWinRate:
                total > 0 ? Number(((aiWins / total) * 100).toFixed(1)) : 0,
            tickerCount: TICKERS.length,
        },
        cases: sortedCases,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n✓ Saved ${total} cases to ${OUTPUT_PATH}`);
    console.log(`  Signal win rate: ${output.meta.winRate}%`);
    console.log(`  AI win rate: ${output.meta.aiWinRate}%`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
