import { describe, it, expect } from 'vitest';
import { hasSnapshot } from '../../lib/hasSnapshot';
import type { MarketFearGreedViewSnapshot } from '../../model';

const SNAPSHOT: MarketFearGreedViewSnapshot = {
    score: 50,
    label: 'NEUTRAL',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-01-01',
};

describe('hasSnapshot', () => {
    it('snapshot이 null이면 false다 — 표본 부족 상태를 캐시에 굳히지 않는다', () => {
        expect(hasSnapshot({ snapshot: null, comparisons: [] })).toBe(false);
    });

    it('snapshot이 있으면 true다', () => {
        expect(hasSnapshot({ snapshot: SNAPSHOT, comparisons: [] })).toBe(true);
    });
});
