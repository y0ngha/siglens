import type {
    BacktestEntryType,
    BacktestLegExitReason,
    BacktestRunData,
    BacktestTradePlan,
} from '@y0ngha/siglens-core';
import { tradeKey } from '@/entities/backtest-case/lib/tradeKey';

type UnknownRecord = Record<string, unknown>;

const VALID_ENTRY_TYPES: readonly unknown[] = [
    'enter_close',
    'enter_selloff',
    'wait_limit',
] satisfies BacktestEntryType[];
const VALID_LEG_REASONS: readonly unknown[] = [
    'tp1',
    'tp_final',
    'sl1',
    'sl2',
    'breakeven',
    'selloff_ma5',
    'selloff_time',
    'selloff_stop',
    'max_hold',
    'open',
] satisfies BacktestLegExitReason[];
const VALID_PLAN_SOURCES: readonly unknown[] = [
    'ai',
    'fallback',
] satisfies BacktestTradePlan['source'][];

const LEG_COUNT = 2;
/** 생성기가 다리·합계 수익률을 각각 소수 둘째 자리로 반올림하므로 그만큼의 오차는 허용한다. */
const RETURN_TOLERANCE_PCT = 0.02;
const SIZE_TOLERANCE = 1e-9;

/** 케이스 날짜 형식. 월 그룹 키(`YYYY-MM`)가 여기서 파생된다. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 형식뿐 아니라 실제 달력에 있는 날짜인지 확인한다. `Date`는 `2026-02-30`을 3월 2일로
 * 넘겨 파싱하므로, 다시 ISO 문자열로 바꿔 입력과 같은지 비교한다.
 */
function isCalendarDate(value: unknown): value is string {
    if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

function requireDate(source: UnknownRecord, key: string, path: string): void {
    if (!isCalendarDate(source[key])) {
        throw new Error(`${path}.${key} must be a YYYY-MM-DD string`);
    }
}

function requireNumber(source: UnknownRecord, key: string, path: string): void {
    if (!isFiniteNumber(source[key])) {
        throw new Error(`${path}.${key} must be a finite number`);
    }
}

function requireString(source: UnknownRecord, key: string, path: string): void {
    if (typeof source[key] !== 'string') {
        throw new Error(`${path}.${key} must be a string`);
    }
}

function requireOneOf(
    source: UnknownRecord,
    key: string,
    allowed: readonly unknown[],
    path: string
): void {
    if (!allowed.includes(source[key])) {
        throw new Error(
            `${path}.${key} must be one of ${allowed.join(', ')} (got ${String(source[key])})`
        );
    }
}

function validateLeg(leg: unknown, path: string): number {
    if (!isRecord(leg)) throw new Error(`${path} must be an object`);
    if (leg['name'] !== 'A' && leg['name'] !== 'B') {
        throw new Error(`${path}.name must be 'A' or 'B'`);
    }
    requireNumber(leg, 'size', path);
    requireDate(leg, 'exitDate', path);
    requireNumber(leg, 'exitPrice', path);
    requireOneOf(leg, 'reason', VALID_LEG_REASONS, path);
    requireNumber(leg, 'returnPct', path);
    return (leg['size'] as number) * (leg['returnPct'] as number);
}

function validatePlan(plan: unknown, path: string): void {
    if (!isRecord(plan)) throw new Error(`${path} must be an object`);
    for (const key of ['tp1', 'tpFinal', 'sl1', 'sl2']) {
        requireNumber(plan, key, path);
    }
    requireOneOf(plan, 'source', VALID_PLAN_SOURCES, path);
}

function validateTrade(trade: unknown, i: number): string {
    const path = `trades[${i}]`;
    if (!isRecord(trade)) throw new Error(`${path} must be an object`);
    requireString(trade, 'ticker', path);
    requireOneOf(trade, 'entryType', VALID_ENTRY_TYPES, path);
    for (const key of ['decisionDate', 'entryDate', 'exitDate']) {
        requireDate(trade, key, path);
    }
    for (const key of [
        'entryPrice',
        'holdingDays',
        'returnPct',
        'holdingReviews',
    ]) {
        requireNumber(trade, key, path);
    }
    requireString(trade, 'summary', path);

    const legs: unknown = trade['legs'];
    if (!Array.isArray(legs) || legs.length !== LEG_COUNT) {
        throw new Error(`${path}.legs must have exactly ${LEG_COUNT} entries`);
    }
    if (
        !isRecord(legs[0]) ||
        legs[0]['name'] !== 'A' ||
        !isRecord(legs[1]) ||
        legs[1]['name'] !== 'B'
    ) {
        // 화면(`exitPathOf`)은 `[a, b] = legs`로 위치를 읽는다.
        throw new Error(`${path}.legs must be ordered [A, B]`);
    }
    const weighted = legs.reduce<number>(
        (sum, leg: unknown, j) => sum + validateLeg(leg, `${path}.legs[${j}]`),
        0
    );
    const sizeSum = legs.reduce<number>(
        (sum, leg: UnknownRecord) => sum + (leg['size'] as number),
        0
    );
    if (Math.abs(sizeSum - 1) > SIZE_TOLERANCE) {
        throw new Error(`${path}.legs sizes must sum to 1`);
    }
    if (
        Math.abs((trade['returnPct'] as number) - weighted) >
        RETURN_TOLERANCE_PCT
    ) {
        throw new Error(
            `${path}.returnPct must equal the size-weighted leg return`
        );
    }
    validatePlan(trade['initialPlan'], `${path}.initialPlan`);
    return trade['ticker'] as string;
}

function validateBaseline(value: unknown, path: string): string {
    if (!isRecord(value)) throw new Error(`${path} must be an object`);
    requireString(value, 'ticker', path);
    for (const key of ['buyHoldPct', 'buyHoldMaxDrawdownPct', 'tradingDays']) {
        requireNumber(value, key, path);
    }
    return value['ticker'] as string;
}

const TREND_LABELS = ['bullish', 'bearish', 'neutral'] as const;

function validateTrendRecognition(value: unknown): void {
    const path = 'trendRecognition';
    if (!isRecord(value)) throw new Error(`${path} must be an object`);
    for (const key of ['windowDays', 'directionalCalls', 'matchRatePct']) {
        requireNumber(value, key, path);
    }
    const byTrend = value['byTrend'];
    if (!isRecord(byTrend))
        throw new Error(`${path}.byTrend must be an object`);
    for (const label of TREND_LABELS) {
        const stat = byTrend[label];
        if (!isRecord(stat)) {
            throw new Error(`${path}.byTrend.${label} must be an object`);
        }
        for (const key of ['calls', 'priorMeanPct', 'priorUpRatePct']) {
            requireNumber(stat, key, `${path}.byTrend.${label}`);
        }
    }
}

function validateRun(run: unknown): void {
    if (!isRecord(run)) throw new Error('run must be an object');
    requireDate(run, 'periodStart', 'run');
    requireDate(run, 'periodEnd', 'run');
    for (const key of [
        'runId',
        'model',
        'coreVersion',
        'promptVersion',
        'siglensVersion',
        'generatedAt',
        'resultsUrl',
        'releaseUrl',
    ]) {
        requireString(run, key, 'run');
    }
    const tickers: unknown = run['tickers'];
    if (!Array.isArray(tickers) || !tickers.every(t => typeof t === 'string')) {
        throw new Error('run.tickers must be an array of strings');
    }
}

/**
 * `data.json`을 경계에서 검증한다. 정적 데이터라 실패는 빌드에서 던진다(런타임 폴백 없음).
 * 통계는 여기서 만들지 않는다 — `deriveBacktestStats`가 `trades`에서 계산한다.
 */
export function validateBacktestRunData(data: unknown): BacktestRunData {
    if (!isRecord(data)) throw new Error('BacktestRunData must be an object');
    validateRun(data['run']);

    const baselines: unknown = data['baselines'];
    if (!Array.isArray(baselines)) {
        throw new Error('baselines must be an array');
    }
    const baselineTickers = new Set(
        baselines.map((b: unknown, i) => validateBaseline(b, `baselines[${i}]`))
    );
    validateBaseline(data['spy'], 'spy');
    validateTrendRecognition(data['trendRecognition']);

    const trades: unknown = data['trades'];
    if (!Array.isArray(trades)) throw new Error('trades must be an array');
    const tradedTickers = new Set(trades.map(validateTrade));
    // 화면은 `tradeKey`로 서버 행과 클라이언트 상세를 잇는다. 키가 겹치면 한 매매의 상세가
    // 다른 매매로 조용히 덮인다.
    const seen = new Set<string>();
    for (const [i, trade] of (trades as UnknownRecord[]).entries()) {
        const key = tradeKey({
            ticker: trade['ticker'] as string,
            entryDate: trade['entryDate'] as string,
        });
        if (seen.has(key)) {
            throw new Error(`trades[${i}] duplicates trade key ${key}`);
        }
        seen.add(key);
    }
    // 탭(`run.tickers`)과 통계(`baselines`)가 같은 종목 집합이어야 한다 — 어긋나면 어떤 매매는
    // 탭으로 거를 수 없고, 어떤 탭은 늘 비어 있다.
    const runTickers = new Set(
        (data['run'] as UnknownRecord)['tickers'] as string[]
    );
    const runMismatch = [
        ...[...runTickers].filter(t => !baselineTickers.has(t)),
        ...[...baselineTickers].filter(t => !runTickers.has(t)),
    ];
    if (runMismatch.length > 0) {
        throw new Error(
            `run.tickers must equal the baseline tickers (mismatch: ${runMismatch.join(', ')})`
        );
    }
    const missing = [...tradedTickers].filter(t => !baselineTickers.has(t));
    if (missing.length > 0) {
        throw new Error(
            `baselines must include every traded ticker (missing: ${missing.join(', ')})`
        );
    }
    return data as unknown as BacktestRunData;
}
