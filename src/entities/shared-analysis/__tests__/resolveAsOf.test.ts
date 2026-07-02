import { resolveAsOf } from '../lib/resolveAsOf';
import type { SharedAnalysisSnapshot } from '../types';

function makeSnapshot(analyzedAt?: string): SharedAnalysisSnapshot {
    return {
        kind: 'chart',
        symbol: 'AAPL',
        context: {
            symbol: 'AAPL',
            displayName: 'Apple Inc.',
            assetClass: 'us_equity',
            ...(analyzedAt !== undefined && { analyzedAt }),
        },
        result: {} as SharedAnalysisSnapshot['result'],
    } as unknown as SharedAnalysisSnapshot;
}

const CREATED_AT = '2024-01-15T09:00:00.000Z';
const ANALYZED_AT = '2024-01-14T18:30:00.000Z';

describe('resolveAsOf', () => {
    it('returns analyzedAt when present in snapshot context', () => {
        const snapshot = makeSnapshot(ANALYZED_AT);
        expect(resolveAsOf(snapshot, CREATED_AT)).toBe(ANALYZED_AT);
    });

    it('returns createdAt when analyzedAt is absent', () => {
        const snapshot = makeSnapshot(undefined);
        expect(resolveAsOf(snapshot, CREATED_AT)).toBe(CREATED_AT);
    });
});
