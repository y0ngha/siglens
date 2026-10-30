/**
 * toShareKeyLevels — chart snapshot `keyLevels` → `ClusteredKeyLevels` for the
 * read-only `AnalysisPanel`.
 */

import type { KeyLevels } from '@y0ngha/siglens-core';
import { toShareKeyLevels } from '@/views/share/lib/shareKeyLevels';

describe('toShareKeyLevels', () => {
    it('returns empty support and resistance when the snapshot has no keyLevels', () => {
        expect(toShareKeyLevels(undefined)).toEqual({
            support: [],
            resistance: [],
            poc: undefined,
        });
    });

    it('drops levels without a positive price or a reason', () => {
        const keyLevels: KeyLevels = {
            support: [
                { price: 101, reason: '지지선' },
                { price: 0, reason: '가격 없음' },
                { price: 95, reason: '   ' },
            ],
            resistance: [],
        };
        expect(toShareKeyLevels(keyLevels).support).toEqual([
            {
                price: 101,
                reason: '지지선',
                count: 1,
                sources: [{ price: 101, reason: '지지선' }],
            },
        ]);
    });

    // No live price on a snapshot, so adjacent levels must not merge.
    it('keeps adjacent levels as separate clusters', () => {
        const keyLevels: KeyLevels = {
            support: [],
            resistance: [
                { price: 200, reason: '저항 A' },
                { price: 200.01, reason: '저항 B' },
            ],
        };
        expect(
            toShareKeyLevels(keyLevels).resistance.map(level => level.count)
        ).toEqual([1, 1]);
    });
});
