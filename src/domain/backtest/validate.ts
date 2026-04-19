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
