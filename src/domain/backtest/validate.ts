import type { BacktestData, BacktestOutcome } from '@/domain/types';

const VALID_OUTCOMES: BacktestOutcome[] = ['win', 'loss'];

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
        if (typeof c['returnPct'] !== 'number') {
            throw new Error(`cases[${i}].returnPct must be a number`);
        }
        // includes() requires BacktestOutcome; cast from unknown is safe after string check
        if (!VALID_OUTCOMES.includes(c['result'] as BacktestOutcome)) {
            throw new Error(`cases[${i}].result must be 'win' or 'loss'`);
        }
        if (
            typeof c['aiAnalysis'] !== 'object' ||
            c['aiAnalysis'] === null ||
            // aiAnalysis confirmed non-null object above; cast to access nested 'tags' field
            !Array.isArray((c['aiAnalysis'] as Record<string, unknown>)['tags'])
        ) {
            throw new Error(`cases[${i}].aiAnalysis.tags must be an array`);
        }
    });

    // Safe: all required fields validated above
    return data as BacktestData;
}
