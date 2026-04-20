/**
 * 백테스팅 데이터 생성 스크립트 (멀티-시그널 confluence + Gemini Batch API)
 *
 * 사용법:
 *   npx tsx scripts/backtests/generate-backtest.ts          # 정상 실행 (저장된 batch가 있으면 resume)
 *   FORCE_FRESH=1 npx tsx scripts/backtests/generate-backtest.ts  # 저장된 batch 무시, 새 배치 제출
 *
 * 환경변수 (.env.local):
 *   FMP_API_KEY     — Financial Modeling Prep API 키
 *   GEMINI_API_KEY  — Google Gemini API 키 (Batch API 지원 모델 필요)
 *   GEMINI_MODEL    — 선택, 기본 'gemini-2.5-pro' (gemini-2.5-pro 이상 권장)
 *   FORCE_FRESH     — '1'이면 .batch-job.txt 무시하고 새로 제출
 *
 * 출력: src/app/backtesting/data.json
 *
 * 아키텍처 (5-phase):
 *   1) collectAllCandidates — FMP bars 수집 + findEntryCandidates + 프롬프트 빌드
 *   2) submitBatch          — ai.batches.create(InlinedRequest[]) → batch.name 저장
 *   3) pollUntilComplete    — ai.batches.get 30초 폴링 (2시간 타임아웃)
 *   4) materializeCases     — 응답 ↔ 후보 zip → parse + simulateExit → BacktestCase
 *   5) writeOutput          — 정렬 + meta 집계 + data.json 쓰기
 *
 * 설계 문서: docs/superpowers/specs/2026-04-20-multi-signal-backtest-design.md
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { GoogleGenAI, JobState } from '@google/genai';
import type { InlinedRequest, InlinedResponse } from '@google/genai';
import { calculateIndicators, calculateMA } from '@/domain/indicators';
import { detectSignals } from '@/domain/signals';
import { simulateExit } from '@/domain/backtest/exit';
import { signalTypeToTagLabel } from '@/domain/backtest/tags';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import {
    AI_SYSTEM_PROMPT,
    parseJsonResponse,
} from '@/infrastructure/ai/utils';
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

const FROM_DATE_FETCH = '2024-09-01';
const DISPLAY_START_DATE = '2025-04-01';
const TO_DATE = '2026-04-20';

const OUTPUT_PATH = resolve(process.cwd(), 'src/app/backtesting/data.json');
const BATCH_STATE_PATH = resolve(
    process.cwd(),
    'scripts/backtests/.batch-job.txt'
);

const MAX_SIGNALS_PER_TICKER = 10;
const MAX_TAGS_PER_CASE = 3;
const MIN_BARS = 120;
const MIN_CONFLUENCE = 3;
const HOLD_DAYS = 10;
const CONTEXT_BARS = 120;
const FMP_SLEEP_MS = 1_000;

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_MS = 2 * 60 * 60 * 1_000; // 2h
const POLL_WARN_MS = 60 * 60 * 1_000; // 1h

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-pro';
/**
 * MUST stay in sync with worker/src/gemini.ts DEFAULT_THINKING_BUDGET.
 * Changing here without also updating the worker (or vice versa) will cause
 * backtest and production AI responses to diverge.
 */
// pro: 32768 — worker/src/gemini.ts와 동일 상한 유지.
const GEMINI_THINKING_BUDGET = Number(
    process.env.GEMINI_THINKING_BUDGET ?? '32768'
);

const DECISIVENESS_SUFFIX = `

[Backtest evaluation directive]
When technical indicators are clearly aligned in either direction, prefer 'enter' or 'avoid' as your entryRecommendation. Reserve 'wait' strictly for genuinely conflicting or ambiguous setups. Your decisive call (enter/avoid) is preferred over excessive caution.

The 'summary' field should be concise — 2 to 3 complete sentences, total length under 250 characters. Always end each sentence with proper punctuation so truncation at a sentence boundary is possible.`;

if (!FMP_API_KEY) throw new Error('FMP_API_KEY is required in .env.local');
if (!GEMINI_API_KEY)
    throw new Error('GEMINI_API_KEY is required in .env.local');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * 텍스트를 maxLength 이내로 자르되, 가능하면 마지막 문장 종결점에서 자른다.
 * 자를 경계(. ! ?)가 maxLength의 절반 이후에 있을 때만 사용 — 너무 짧게 잘리는 것 방지.
 * 종결점을 찾지 못하면 말줄임표(…)를 붙여 명시적으로 잘렸음을 표시.
 */
function truncateAtSentenceBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    const clipped = text.slice(0, maxLength);
    const lastPeriod = Math.max(
        clipped.lastIndexOf('.'),
        clipped.lastIndexOf('!'),
        clipped.lastIndexOf('?')
    );
    if (lastPeriod > maxLength / 2) {
        return clipped.slice(0, lastPeriod + 1);
    }
    return clipped.trimEnd() + '…';
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

function findEntryCandidates(bars: Bar[], fmpBars: FmpBar[]): EntryCandidate[] {
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

    // MA50 시리즈를 한 번만 계산 (O(n*50), 루프 밖). 종가 > MA50 조건으로
    // 중기 상승추세 확인 필터에 사용.
    const ma50Series = calculateMA(bars, 50);

    // O(n²) sweep: 각 bar마다 prefix를 잘라 calculateIndicators + detectSignals 재실행.
    // 운영 코드와 동일한 탐지 로직을 재사용하기 위한 의도적 단순화 (spec 섹션 10.4).
    // n ≈ 400 bars × 10 tickers 수준에서 실측 수분 내 완료.
    for (let i = MIN_BARS; i < bars.length - HOLD_DAYS; i++) {
        const prefix = bars.slice(0, i + 1);
        const indicators = calculateIndicators(prefix);
        const bullishTypes = new Set(
            detectSignals(prefix, indicators)
                .filter(s => s.direction === 'bullish')
                .map(s => s.type)
        );
        const fresh = [...bullishTypes].filter(t => !lastBullishTypes.has(t));

        const entryDate = fmpBars[i].date;
        const inDisplayRange = entryDate >= DISPLAY_START_DATE;

        const ma50AtI = ma50Series[i];
        const closeAboveMa50 =
            ma50AtI !== null && fmpBars[i].close > ma50AtI;

        if (
            inDisplayRange &&
            i > cooldownUntil &&
            bullishTypes.size >= MIN_CONFLUENCE &&
            fresh.length >= 1 &&
            closeAboveMa50
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

// ─── AI 분석 결과 타입 ─────────────────────────────────────────────────────────

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

function decodeAnalysis(text: string): AiAnalysisForBacktest {
    const raw = parseJsonResponse<RawAnalysisResponse>(text, 'analysis');
    const result = enrichAnalysisWithConfidence(raw, []);

    const rawRec = result.actionRecommendation?.entryRecommendation;
    const entryRecommendation: EntryRecommendation = isValidEntryRecommendation(
        rawRec
    )
        ? rawRec
        : 'wait';

    return {
        trend: result.trend,
        summary: truncateAtSentenceBoundary(result.summary ?? '', 250),
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

// ─── Phase 1: 후보 수집 ────────────────────────────────────────────────────────

interface CandidateWithPrompt {
    ticker: string;
    idx: number;
    entryDate: string;
    entryPrice: number;
    signalTypes: string[];
    bars: Bar[];
    fmpBars: FmpBar[];
    prompt: string;
}

function buildPromptForCandidate(
    ticker: string,
    bars: Bar[],
    idx: number
): string {
    const contextBars = bars.slice(
        Math.max(0, idx - CONTEXT_BARS + 1),
        idx + 1
    );
    const indicators = calculateIndicators(contextBars);
    return (
        buildAnalysisPrompt(ticker, contextBars, indicators, [], '1Day') +
        DECISIVENESS_SUFFIX
    );
}

async function collectAllCandidates(): Promise<CandidateWithPrompt[]> {
    let all: CandidateWithPrompt[] = [];

    // FMP 레이트 리밋 회피를 위해 순차 실행 (10 tickers × ~1-2s → 10-20s).
    for (const ticker of TICKERS) {
        console.log(`[${ticker}] Fetching bars...`);
        const fmpBars = await fetchDailyBars(ticker);
        await sleep(FMP_SLEEP_MS);
        if (fmpBars.length < MIN_BARS + 1) {
            console.log(`  Skipping — not enough bars (${fmpBars.length})`);
            continue;
        }
        const bars = toBarArray(fmpBars);
        const candidates = findEntryCandidates(bars, fmpBars);
        console.log(`  Found ${candidates.length} entry candidates`);

        const withPrompts = candidates.map(c => ({
            ticker,
            idx: c.idx,
            entryDate: c.entryDate,
            entryPrice: c.entryPrice,
            signalTypes: c.signalTypes,
            bars,
            fmpBars,
            prompt: buildPromptForCandidate(ticker, bars, c.idx),
        }));

        all = [...all, ...withPrompts];
    }

    return all;
}

// ─── Phase 2: Batch 제출 ───────────────────────────────────────────────────────

/**
 * Request-level config mirrors worker/src/gemini.ts:callGemini options
 * (temperature, topP, maxOutputTokens, responseMimeType, systemInstruction).
 * MUST stay in sync — divergence breaks parity between backtest and live AI.
 */
function buildInlinedRequest(c: CandidateWithPrompt): InlinedRequest {
    // worker/src/gemini.ts의 callGemini 구성과 동일한 config을 사용한다.
    // 배치 응답이 동기 호출과 동일한 shape을 갖도록 responseMimeType/systemInstruction/
    // temperature/topP/maxOutputTokens/thinkingConfig를 일치시킨다.
    return {
        contents: [{ parts: [{ text: c.prompt }] }],
        metadata: {
            ticker: c.ticker,
            entryDate: c.entryDate,
            idx: String(c.idx),
        },
        config: {
            systemInstruction: AI_SYSTEM_PROMPT,
            temperature: 0,
            topP: 0.95,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            thinkingConfig: {
                thinkingBudget: GEMINI_THINKING_BUDGET,
                includeThoughts: false,
            },
        },
    };
}

async function submitBatch(
    candidates: readonly CandidateWithPrompt[]
): Promise<string> {
    const requests: InlinedRequest[] = candidates.map(buildInlinedRequest);
    const displayName = `siglens-backtest-${Date.now()}`;
    console.log(
        `[batch] Submitting ${requests.length} requests (model=${GEMINI_MODEL}, displayName=${displayName})...`
    );
    const batch = await ai.batches.create({
        model: GEMINI_MODEL,
        src: requests,
        config: { displayName },
    });
    const name = batch.name;
    if (!name)
        throw new Error('Batch create response missing resource name (.name)');
    saveBatchState(name, candidates);
    console.log(`[batch] Created ${name} (state=${batch.state ?? 'UNKNOWN'})`);
    console.log(`[batch] Resource name saved to ${BATCH_STATE_PATH}`);
    return name;
}

// ─── Phase 3: 폴링 ─────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}m${rem}s`;
    const h = Math.floor(m / 60);
    return `${h}h${m % 60}m`;
}

async function pollUntilComplete(
    batchName: string
): Promise<InlinedResponse[]> {
    const start = Date.now();
    let warned = false;

    while (true) {
        const elapsed = Date.now() - start;
        if (elapsed > MAX_POLL_MS) {
            throw new Error(
                `[batch] Timeout — exceeded ${formatElapsed(MAX_POLL_MS)} waiting for ${batchName}`
            );
        }

        const status = await ai.batches.get({ name: batchName });
        const state = status.state ?? 'UNKNOWN';
        console.log(
            `[poll] state=${state} elapsed=${formatElapsed(elapsed)}`
        );

        if (state === JobState.JOB_STATE_SUCCEEDED) {
            const responses = status.dest?.inlinedResponses ?? [];
            console.log(
                `[batch] Succeeded — received ${responses.length} responses`
            );
            return responses;
        }
        if (
            state === JobState.JOB_STATE_FAILED ||
            state === JobState.JOB_STATE_CANCELLED ||
            state === JobState.JOB_STATE_EXPIRED
        ) {
            const errMsg = status.error?.message ?? 'no error message';
            throw new Error(`[batch] Job ${state} for ${batchName}: ${errMsg}`);
        }

        if (!warned && elapsed > POLL_WARN_MS) {
            console.warn(
                `[batch] WARNING — batch has been running for over 1h (limit 2h).`
            );
            warned = true;
        }

        await sleep(POLL_INTERVAL_MS);
    }
}

// ─── Phase 4: 응답 → BacktestCase 변환 ─────────────────────────────────────────

function extractResponseText(resp: InlinedResponse): string | null {
    const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() !== '' ? text : null;
}

function buildBacktestCase(
    c: CandidateWithPrompt,
    ai: AiAnalysisForBacktest
): BacktestCase {
    const safeStopLoss =
        ai.stopLoss !== undefined && ai.stopLoss < c.entryPrice
            ? ai.stopLoss
            : undefined;
    const safeTakeProfit =
        ai.takeProfit !== undefined && ai.takeProfit > c.entryPrice
            ? ai.takeProfit
            : undefined;

    const exit = simulateExit({
        bars: c.bars,
        entryIdx: c.idx,
        entryPrice: c.entryPrice,
        stopLoss: safeStopLoss,
        takeProfit: safeTakeProfit,
        maxHoldDays: HOLD_DAYS,
    });

    const result: BacktestSignalResult = exit.returnPct >= 0 ? 'win' : 'loss';
    const aiResult = computeAiResult(ai.entryRecommendation, exit.returnPct);
    const aiTrendHit = computeAiTrendHit(
        ai.trend,
        ai.bullishTargets,
        c.bars,
        c.idx,
        exit.exitIdx
    );
    const exitReason: BacktestExitReason = exit.exitReason;

    console.log(
        `  [${c.ticker}] ${c.entryDate} → ${c.fmpBars[exit.exitIdx].date} | ${exit.returnPct.toFixed(1)}% (${result}, ${exitReason}, ai=${aiResult})`
    );

    return {
        ticker: c.ticker,
        entryDate: c.entryDate,
        entryPrice: c.entryPrice,
        exitDate: c.fmpBars[exit.exitIdx].date,
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
            tags: c.signalTypes.map(signalTypeToTagLabel),
        },
    };
}

function materializeCases(
    candidates: readonly CandidateWithPrompt[],
    responses: readonly InlinedResponse[]
): BacktestCase[] {
    if (responses.length !== candidates.length) {
        console.warn(
            `[materialize] WARNING — candidates(${candidates.length}) / responses(${responses.length}) count mismatch. ` +
                `Zipping by index; trailing extras will be dropped.`
        );
    }

    const n = Math.min(candidates.length, responses.length);
    const pairs = Array.from({ length: n }, (_, i) => ({
        candidate: candidates[i],
        response: responses[i],
    }));

    return pairs.flatMap(({ candidate, response }) => {
        if (response.error) {
            const msg = response.error.message ?? 'unknown error';
            console.warn(
                `  [${candidate.ticker} ${candidate.entryDate}] skipped — response error: ${msg}`
            );
            return [];
        }

        const text = extractResponseText(response);
        if (text === null) {
            console.warn(
                `  [${candidate.ticker} ${candidate.entryDate}] skipped — empty response text`
            );
            return [];
        }

        try {
            const ai = decodeAnalysis(text);
            return [buildBacktestCase(candidate, ai)];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(
                `  [${candidate.ticker} ${candidate.entryDate}] skipped — parse error: ${msg}`
            );
            return [];
        }
    });
}

// ─── Phase 5: 출력 ─────────────────────────────────────────────────────────────

function writeOutput(allCases: BacktestCase[]): void {
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
    console.log(`\n[done] Saved ${total} cases to ${OUTPUT_PATH}`);
    console.log(`  Signal win rate: ${meta.winRate}%`);
    console.log(`  AI win rate (decisive only): ${meta.aiWinRate}%`);
    console.log(`  AI trend hit rate: ${meta.aiTrendHitRate}%`);
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

interface BatchJobState {
    batchName: string;
    savedAt: string; // ISO timestamp
    candidateManifest: Array<{
        ticker: string;
        idx: number;
        entryDate: string; // cross-check
    }>;
}

function saveBatchState(
    batchName: string,
    candidates: readonly CandidateWithPrompt[]
): void {
    const state: BatchJobState = {
        batchName,
        savedAt: new Date().toISOString(),
        candidateManifest: candidates.map(c => ({
            ticker: c.ticker,
            idx: c.idx,
            entryDate: c.entryDate,
        })),
    };
    writeFileSync(
        BATCH_STATE_PATH,
        JSON.stringify(state, null, 2),
        'utf-8'
    );
}

function loadBatchState(): BatchJobState | null {
    if (process.env.FORCE_FRESH === '1') {
        console.log('[resume] FORCE_FRESH=1 — skipping saved batch');
        return null;
    }
    if (!existsSync(BATCH_STATE_PATH)) return null;
    try {
        const raw = readFileSync(BATCH_STATE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as BatchJobState;
        if (
            typeof parsed.batchName !== 'string' ||
            !Array.isArray(parsed.candidateManifest)
        ) {
            console.warn(
                `[resume] ${BATCH_STATE_PATH} has unexpected shape — ignoring.`
            );
            return null;
        }
        return parsed;
    } catch (err) {
        console.warn(
            `[resume] Failed to parse ${BATCH_STATE_PATH}: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
    }
}

function assertManifestMatch(
    saved: BatchJobState['candidateManifest'],
    current: readonly CandidateWithPrompt[]
): void {
    if (saved.length !== current.length) {
        throw new Error(
            `[resume] Candidate count changed (saved=${saved.length} current=${current.length}). ` +
                `Batch responses won't align. Set FORCE_FRESH=1 to submit a new batch.`
        );
    }
    for (let i = 0; i < saved.length; i++) {
        const s = saved[i];
        const c = current[i];
        if (
            s.ticker !== c.ticker ||
            s.idx !== c.idx ||
            s.entryDate !== c.entryDate
        ) {
            throw new Error(
                `[resume] Candidate manifest drift at index ${i}: ` +
                    `saved=${s.ticker}/${s.idx}/${s.entryDate} ` +
                    `current=${c.ticker}/${c.idx}/${c.entryDate}. ` +
                    `Set FORCE_FRESH=1 to submit a new batch.`
            );
        }
    }
}

function clearBatchState(): void {
    try {
        if (existsSync(BATCH_STATE_PATH)) unlinkSync(BATCH_STATE_PATH);
    } catch (err) {
        console.warn(
            `[cleanup] Failed to remove ${BATCH_STATE_PATH}: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}

async function main(): Promise<void> {
    const savedState = loadBatchState();

    // Phase 1 — 후보 수집 (findEntryCandidates는 결정적이므로 resume 시에도 동일 순서 보장)
    console.log('\n=== Phase 1: Collecting candidates ===');
    const candidates = await collectAllCandidates();
    console.log(`\n[phase1] Total candidates: ${candidates.length}`);
    if (candidates.length === 0) {
        console.log('[phase1] No candidates found — exiting.');
        return;
    }

    // Phase 2 — Batch 제출 (또는 resume 시 skip)
    let batchName: string;
    if (savedState) {
        assertManifestMatch(savedState.candidateManifest, candidates);
        console.log(
            `\n=== Phase 2: SKIPPED (resuming batch ${savedState.batchName}) ===`
        );
        batchName = savedState.batchName;
    } else {
        console.log('\n=== Phase 2: Submitting batch ===');
        batchName = await submitBatch(candidates);
    }

    // Phase 3 — 폴링
    console.log('\n=== Phase 3: Polling until complete ===');
    const responses = await pollUntilComplete(batchName);

    // Phase 4 — 응답 materialize
    console.log('\n=== Phase 4: Materializing cases ===');
    const cases = materializeCases(candidates, responses);
    console.log(`[phase4] Materialized ${cases.length} cases`);

    // Phase 5 — 출력
    console.log('\n=== Phase 5: Writing output ===');
    writeOutput(cases);

    // 성공 시에만 state 파일 삭제 (resume 안전성 우선)
    clearBatchState();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
