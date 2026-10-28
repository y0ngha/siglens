import type {
    BacktestAiEntryRecommendation,
    BacktestAiResult,
    BacktestData,
    BacktestExitReason,
    BacktestRiskLevel,
    BacktestSignalResult,
} from '@y0ngha/siglens-core';

const VALID_SIGNAL_RESULTS: BacktestSignalResult[] = ['win', 'loss'];
const VALID_AI_RESULTS: BacktestAiResult[] = ['win', 'loss', 'neutral'];
const VALID_EXIT_REASONS: BacktestExitReason[] = [
    'take_profit',
    'stop_loss',
    'time',
];
const VALID_ENTRY_RECOMMENDATIONS: BacktestAiEntryRecommendation[] = [
    'enter',
    'wait',
    'avoid',
];

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

/**
 * 백테스트 산출물의 모양을 검증하고, `riskLevel`의 별칭(`medium`)을 core 정식 값
 * (`moderate`)으로 정규화한 데이터를 돌려준다. 모르는 위험도 값은 던진다.
 */
export function validateBacktestData(data: unknown): BacktestData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('BacktestData must be an object');
    }
    // Safe: confirmed non-null object above
    const d = data as Record<string, unknown>;

    if (typeof d['meta'] !== 'object' || d['meta'] === null) {
        throw new Error('meta must be an object');
    }

    if (!Array.isArray(d['cases'])) {
        throw new Error('cases must be an array');
    }

    // Array.isArray guard narrows d['cases'] to any[] but not unknown[]; explicit cast needed
    const cases = d['cases'] as unknown[];
    cases.forEach((item, i) => {
        // Each element is unknown; cast to Record to access named fields for validation
        const c = item as Record<string, unknown>;
        (['entryDate', 'exitDate'] as const).forEach(field => {
            const value = c[field];
            if (typeof value !== 'string' || !isCalendarDate(value)) {
                throw new Error(
                    `cases[${i}].${field} must be a YYYY-MM-DD string`
                );
            }
        });
        if (typeof c['returnPct'] !== 'number') {
            throw new Error(`cases[${i}].returnPct must be a number`);
        }
        if (c['signalType'] !== 'buy') {
            throw new Error(`cases[${i}].signalType must be 'buy'`);
        }
        // Array.prototype.includes uses strict equality; non-string values correctly return false
        if (
            !VALID_SIGNAL_RESULTS.includes(c['result'] as BacktestSignalResult)
        ) {
            throw new Error(`cases[${i}].result must be 'win' or 'loss'`);
        }
        if (!VALID_AI_RESULTS.includes(c['aiResult'] as BacktestAiResult)) {
            throw new Error(
                `cases[${i}].aiResult must be 'win', 'loss', or 'neutral'`
            );
        }
        if (
            !VALID_EXIT_REASONS.includes(c['exitReason'] as BacktestExitReason)
        ) {
            throw new Error(
                `cases[${i}].exitReason must be 'take_profit', 'stop_loss', or 'time'`
            );
        }
        if (typeof c['aiTrendHit'] !== 'boolean') {
            throw new Error(`cases[${i}].aiTrendHit must be a boolean`);
        }
        if (
            typeof c['aiAnalysis'] !== 'object' ||
            c['aiAnalysis'] === null ||
            // aiAnalysis confirmed non-null object above; cast to access nested 'tags' field
            !Array.isArray((c['aiAnalysis'] as Record<string, unknown>)['tags'])
        ) {
            throw new Error(`cases[${i}].aiAnalysis.tags must be an array`);
        }

        // aiAnalysis confirmed non-null object with tags array above
        const aiAnalysis = c['aiAnalysis'] as Record<string, unknown>;

        if (
            !VALID_ENTRY_RECOMMENDATIONS.includes(
                aiAnalysis[
                    'entryRecommendation'
                ] as BacktestAiEntryRecommendation
            )
        ) {
            throw new Error(
                `cases[${i}].aiAnalysis.entryRecommendation must be 'enter', 'wait', or 'avoid'`
            );
        }

        if (!Array.isArray(aiAnalysis['bullishTargets'])) {
            throw new Error(
                `cases[${i}].aiAnalysis.bullishTargets must be an array`
            );
        }
        const bullishTargets = aiAnalysis['bullishTargets'] as unknown[];
        bullishTargets.forEach((target, j) => {
            if (typeof target !== 'object' || target === null) {
                throw new Error(
                    `cases[${i}].aiAnalysis.bullishTargets[${j}] must be an object`
                );
            }
            // target confirmed non-null object above; cast to access price/basis fields
            const t = target as Record<string, unknown>;
            if (typeof t['price'] !== 'number') {
                throw new Error(
                    `cases[${i}].aiAnalysis.bullishTargets[${j}].price must be a number`
                );
            }
            if (typeof t['basis'] !== 'string') {
                throw new Error(
                    `cases[${i}].aiAnalysis.bullishTargets[${j}].basis must be a string`
                );
            }
        });

        if (
            aiAnalysis['stopLoss'] !== undefined &&
            typeof aiAnalysis['stopLoss'] !== 'number'
        ) {
            throw new Error(
                `cases[${i}].aiAnalysis.stopLoss must be a number when present`
            );
        }

        if (
            aiAnalysis['takeProfit'] !== undefined &&
            typeof aiAnalysis['takeProfit'] !== 'number'
        ) {
            throw new Error(
                `cases[${i}].aiAnalysis.takeProfit must be a number when present`
            );
        }

        if (
            aiAnalysis['riskLevel'] !== undefined &&
            typeof aiAnalysis['riskLevel'] !== 'string'
        ) {
            throw new Error(
                `cases[${i}].aiAnalysis.riskLevel must be a string when present`
            );
        }

        if (
            typeof aiAnalysis['riskLevel'] === 'string' &&
            !isBacktestRiskLevel(normalizeRiskLevel(aiAnalysis['riskLevel']))
        ) {
            throw new Error(
                `cases[${i}].aiAnalysis.riskLevel must be 'low', 'moderate' (alias 'medium'), 'high', or 'extreme' when present`
            );
        }
    });

    // 검증기가 보장하는 것: 위에서 확인한 케이스 필드와 정규화된 riskLevel.
    // meta 내부 필드는 확인하지 않고 산출물을 신뢰한다.
    return { ...d, cases: cases.map(normalizeCase) } as unknown as BacktestData;
}
