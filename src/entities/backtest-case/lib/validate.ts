import type {
    BacktestAiEntryRecommendation,
    BacktestAiResult,
    BacktestData,
    BacktestExitReason,
    BacktestRiskLevel,
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

/** 케이스 날짜(`entryDate`/`exitDate`) 형식. 월 그룹 키(`YYYY-MM`)가 여기서 파생된다. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 형식뿐 아니라 실제 달력에 있는 날짜인지 확인한다. `Date`는 `2026-02-30`을 3월 2일로
 * 넘겨 파싱하므로, 다시 ISO 문자열로 바꿔 입력과 같은지 비교한다.
 */
function isCalendarDate(value: string): boolean {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

const VALID_RISK_LEVELS: BacktestRiskLevel[] = [
    'low',
    'moderate',
    'high',
    'extreme',
];

/**
 * 산출물(`data.json`)이 쓰는 위험도 별칭 → core 정식 값.
 * 생성기는 중간 단계를 `medium`으로 적는데 core 타입은 `moderate`다.
 */
const RISK_LEVEL_ALIASES: Readonly<Record<string, BacktestRiskLevel>> = {
    medium: 'moderate',
};

function isBacktestRiskLevel(level: string): level is BacktestRiskLevel {
    return VALID_RISK_LEVELS.some(valid => valid === level);
}

function normalizeRiskLevel(level: string): string {
    // `in`은 프로토타입까지 보므로 자기 키만 인정한다.
    return Object.hasOwn(RISK_LEVEL_ALIASES, level)
        ? RISK_LEVEL_ALIASES[level]
        : level;
}

/** 검증을 통과한 케이스의 `riskLevel` 별칭을 정식 값으로 바꾼 사본. 없으면 그대로 둔다. */
function normalizeCase(item: unknown): unknown {
    // validateBacktestData가 케이스와 `aiAnalysis`가 object임을 이미 확인한 뒤에만 부르므로
    // 이 단언은 안전하다. 별도 가드는 같은 검사를 되풀이할 뿐이라 두지 않는다.
    const c = item as Record<string, unknown> & {
        aiAnalysis: Record<string, unknown>;
    };
    const riskLevel = c.aiAnalysis['riskLevel'];
    if (typeof riskLevel !== 'string') return c;
    return {
        ...c,
        aiAnalysis: {
            ...c.aiAnalysis,
            riskLevel: normalizeRiskLevel(riskLevel),
        },
    };
}

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
    const riskLevel = value['riskLevel'];
    if (
        typeof riskLevel === 'string' &&
        !isBacktestRiskLevel(normalizeRiskLevel(riskLevel))
    ) {
        throw new Error(
            `${path}.riskLevel must be 'low', 'moderate' (alias 'medium'), 'high', or 'extreme' when present`
        );
    }
}

function validateCase(item: unknown, i: number): void {
    const path = `cases[${i}]`;
    if (!isRecord(item)) {
        throw new Error(`${path} must be an object`);
    }
    for (const field of ['entryDate', 'exitDate']) {
        const value = item[field];
        if (typeof value !== 'string' || !isCalendarDate(value)) {
            throw new Error(`${path}.${field} must be a YYYY-MM-DD string`);
        }
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
 * 번들된 백테스트 JSON을 런타임에 검증해 `BacktestData`로 좁히고, `riskLevel`의 별칭
 * (`medium`)을 core 정식 값(`moderate`)으로 정규화한 데이터를 돌려준다. 모르는 위험도 값은 던진다.
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

    // 검증기가 보장하는 것: 위에서 확인한 케이스 필드와 정규화된 riskLevel.
    // meta 내부 필드는 확인하지 않고 산출물을 신뢰한다. 타입 가드는 필드 단위로만
    // 좁혀지므로, 위 검증을 모두 통과한 값에 한해 단언한다.
    return {
        ...data,
        cases: cases.map(normalizeCase),
    } as unknown as BacktestData;
}
