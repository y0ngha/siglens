import type {
    BacktestAiEntryRecommendation,
    BacktestAiResult,
    BacktestData,
    BacktestExitReason,
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

export function validateBacktestData(data: unknown): BacktestData {
    if (typeof data !== 'object' || data === null) {
        throw new Error('BacktestData must be an object');
    }
    // Safe: confirmed non-null object above
    const d = data as Record<string, unknown>;

    if (typeof d['meta'] !== 'object' || d['meta'] === null) {
        throw new Error('meta must be an object');
    }
    // meta confirmed non-null object above; cast to access named fields for validation
    const meta = d['meta'] as Record<string, unknown>;
    if (typeof meta['aiTrendHitRate'] !== 'number') {
        throw new Error('meta.aiTrendHitRate must be a number');
    }

    if (!Array.isArray(d['cases'])) {
        throw new Error('cases must be an array');
    }

    // Array.isArray guard narrows d['cases'] to any[] but not unknown[]; explicit cast needed
    const cases = d['cases'] as unknown[];
    cases.forEach((item, i) => {
        // Each element is unknown; cast to Record to access named fields for validation
        const c = item as Record<string, unknown>;
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
    });

    // Safe: all required fields validated above
    return data as BacktestData;
}
