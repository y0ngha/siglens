import type {
    BacktestAiEntryRecommendation,
    BacktestAiResult,
    BacktestData,
    BacktestExitReason,
    BacktestSignalResult,
} from '@y0ngha/siglens-core';

type UnknownRecord = Record<string, unknown>;

const VALID_SIGNAL_RESULTS: readonly unknown[] = [
    'win',
    'loss',
] satisfies BacktestSignalResult[];
const VALID_AI_RESULTS: readonly unknown[] = [
    'win',
    'loss',
    'neutral',
] satisfies BacktestAiResult[];
const VALID_EXIT_REASONS: readonly unknown[] = [
    'take_profit',
    'stop_loss',
    'time',
] satisfies BacktestExitReason[];
const VALID_ENTRY_RECOMMENDATIONS: readonly unknown[] = [
    'enter',
    'wait',
    'avoid',
] satisfies BacktestAiEntryRecommendation[];

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function validateBullishTarget(target: unknown, path: string): void {
    if (!isRecord(target)) {
        throw new Error(`${path} must be an object`);
    }
    if (typeof target['price'] !== 'number') {
        throw new Error(`${path}.price must be a number`);
    }
    if (typeof target['basis'] !== 'string') {
        throw new Error(`${path}.basis must be a string`);
    }
}

/** `stopLoss`/`takeProfit`/`riskLevel`처럼 생략 가능한 필드의 타입만 검사한다. */
function validateOptionalField(
    source: UnknownRecord,
    key: string,
    expected: 'number' | 'string',
    path: string
): void {
    if (source[key] !== undefined && typeof source[key] !== expected) {
        throw new Error(`${path}.${key} must be a ${expected} when present`);
    }
}

function validateAiAnalysis(value: unknown, path: string): void {
    if (!isRecord(value) || !Array.isArray(value['tags'])) {
        throw new Error(`${path}.tags must be an array`);
    }
    if (!VALID_ENTRY_RECOMMENDATIONS.includes(value['entryRecommendation'])) {
        throw new Error(
            `${path}.entryRecommendation must be 'enter', 'wait', or 'avoid'`
        );
    }

    const bullishTargets: unknown = value['bullishTargets'];
    if (!Array.isArray(bullishTargets)) {
        throw new Error(`${path}.bullishTargets must be an array`);
    }
    bullishTargets.forEach((target: unknown, j) =>
        validateBullishTarget(target, `${path}.bullishTargets[${j}]`)
    );

    validateOptionalField(value, 'stopLoss', 'number', path);
    validateOptionalField(value, 'takeProfit', 'number', path);
    validateOptionalField(value, 'riskLevel', 'string', path);
}

function validateCase(item: unknown, i: number): void {
    const path = `cases[${i}]`;
    if (!isRecord(item)) {
        throw new Error(`${path} must be an object`);
    }
    if (typeof item['returnPct'] !== 'number') {
        throw new Error(`${path}.returnPct must be a number`);
    }
    if (item['signalType'] !== 'buy') {
        throw new Error(`${path}.signalType must be 'buy'`);
    }
    if (!VALID_SIGNAL_RESULTS.includes(item['result'])) {
        throw new Error(`${path}.result must be 'win' or 'loss'`);
    }
    if (!VALID_AI_RESULTS.includes(item['aiResult'])) {
        throw new Error(`${path}.aiResult must be 'win', 'loss', or 'neutral'`);
    }
    if (!VALID_EXIT_REASONS.includes(item['exitReason'])) {
        throw new Error(
            `${path}.exitReason must be 'take_profit', 'stop_loss', or 'time'`
        );
    }
    if (typeof item['aiTrendHit'] !== 'boolean') {
        throw new Error(`${path}.aiTrendHit must be a boolean`);
    }
    validateAiAnalysis(item['aiAnalysis'], `${path}.aiAnalysis`);
}

/**
 * 번들된 백테스트 JSON을 런타임에 검증해 `BacktestData`로 좁힌다.
 * `/backtesting` 페이지는 모듈 로드 시점에, 사이트맵은 호출할 때마다 검증하며,
 * 형태가 어긋나면 즉시 실패시키려고 첫 위반에서 throw 한다.
 */
export function validateBacktestData(data: unknown): BacktestData {
    if (!isRecord(data)) {
        throw new Error('BacktestData must be an object');
    }
    if (!isRecord(data['meta'])) {
        throw new Error('meta must be an object');
    }
    const cases: unknown = data['cases'];
    if (!Array.isArray(cases)) {
        throw new Error('cases must be an array');
    }
    cases.forEach(validateCase);

    // 타입 가드는 필드 단위로만 좁혀지므로, 위 검증을 모두 통과한 값에 한해 단언한다.
    return data as unknown as BacktestData;
}
