import { describe, expect, it } from 'vitest';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { marketFearGreedMetaFacts } from '../marketFearGreedAnswer';

const SNAPSHOT = {
    score: 24,
    label: 'EXTREME_FEAR',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const satisfies MarketFearGreedView['snapshot'];

describe('marketFearGreedMetaFacts', () => {
    it('판독값이 없으면 null이다', () => {
        expect(
            marketFearGreedMetaFacts({ snapshot: null, comparisons: [] })
        ).toBeNull();
    });

    it('현재 점·과거 점을 1주·1개월·1년 전 사실로 옮긴다', () => {
        const facts = marketFearGreedMetaFacts({
            snapshot: SNAPSHOT,
            comparisons: [
                {
                    key: 'now',
                    date: '2026-11-05',
                    score: 24,
                    label: 'EXTREME_FEAR',
                },
                { key: '1w', date: '2026-10-29', score: 36, label: 'FEAR' },
                { key: '1m', date: '2026-10-06', score: 51, label: 'NEUTRAL' },
                { key: '1y', date: '2025-11-05', score: 34, label: 'FEAR' },
            ],
        });
        expect(facts).toEqual({
            date: '2026-11-05',
            score: 24,
            label: 'EXTREME_FEAR',
            past: [
                { period: 'week', score: 36 },
                { period: 'month', score: 51 },
                { period: 'year', score: 34 },
            ],
            range: null,
        });
    });

    /**
     * 이력이 짧으면 비교점이 가장 이른 세션으로 당겨진다(시장 뷰는 `clamped`를 싣지 않는다).
     * 몇 주 전 세션을 "1년 전"이라고 부르면 답 문장이 사실과 달라진다.
     */
    it('이력이 짧아 당겨진 비교점은 기간 이름으로 싣지 않는다', () => {
        const facts = marketFearGreedMetaFacts({
            snapshot: SNAPSHOT,
            comparisons: [
                {
                    key: 'now',
                    date: '2026-11-05',
                    score: 24,
                    label: 'EXTREME_FEAR',
                },
                { key: '1w', date: '2026-10-29', score: 36, label: 'FEAR' },
                { key: '1m', date: '2026-10-20', score: 40, label: 'FEAR' },
                { key: '1y', date: '2026-10-20', score: 40, label: 'FEAR' },
            ],
        });
        expect(facts?.past).toEqual([{ period: 'week', score: 36 }]);
    });
});
