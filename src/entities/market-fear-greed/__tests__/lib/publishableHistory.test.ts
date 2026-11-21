import { describe, expect, it } from 'vitest';
import {
    hubView,
    scoredHistory,
} from '@/__tests__/utils/marketFearGreedHubView';
import {
    FEAR_GREED_HISTORY_MIN_POINTS,
    hasPublishableHistory,
    publishableHistory,
    scoredReadings,
} from '../../lib/publishableHistory';

const SNAPSHOT = {
    score: 50,
    label: 'NEUTRAL',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-11-05',
} as const;

describe('scoredReadings', () => {
    it('점수나 라벨이 없는 점은 건너뛴다', () => {
        expect(
            scoredReadings([
                { date: '2026-01-01', score: null, label: null },
                { date: '2026-01-02', score: 40, label: 'FEAR' },
                { date: '2026-01-03', score: null, label: null },
            ])
        ).toEqual([{ date: '2026-01-02', score: 40, label: 'FEAR' }]);
    });
});

describe('hasPublishableHistory', () => {
    it('하한은 20점이다', () => {
        expect(FEAR_GREED_HISTORY_MIN_POINTS).toBe(20);
    });

    it('스냅샷이 없으면 거짓이다', () => {
        expect(
            hasPublishableHistory(
                hubView({ history: scoredHistory(30, '2026-11-05') })
            )
        ).toBe(false);
    });

    it('점수 있는 점이 19개면 거짓이다', () => {
        expect(
            hasPublishableHistory(
                hubView({
                    snapshot: SNAPSHOT,
                    history: scoredHistory(19, '2026-11-05'),
                })
            )
        ).toBe(false);
    });

    it('빈 날은 개수에 세지 않는다', () => {
        expect(
            hasPublishableHistory(
                hubView({
                    snapshot: SNAPSHOT,
                    history: [
                        ...scoredHistory(19, '2026-11-04'),
                        { date: '2026-11-05', score: null, label: null },
                    ],
                })
            )
        ).toBe(false);
    });

    it('마지막 점의 날짜가 기준일과 다르면 거짓이다', () => {
        expect(
            hasPublishableHistory(
                hubView({
                    snapshot: SNAPSHOT,
                    history: scoredHistory(30, '2026-11-04'),
                })
            )
        ).toBe(false);
    });

    it('정확히 20점이고 마지막 날짜가 기준일이면 참이다', () => {
        expect(
            hasPublishableHistory(
                hubView({
                    snapshot: SNAPSHOT,
                    history: scoredHistory(20, '2026-11-05'),
                })
            )
        ).toBe(true);
    });
});

describe('publishableHistory', () => {
    it('통과하면 기준일과 점수 있는 점을 돌려준다', () => {
        const history = [
            ...scoredHistory(20, '2026-11-04'),
            { date: '2026-11-05', score: 50, label: 'NEUTRAL' as const },
        ];
        const result = publishableHistory(
            hubView({ snapshot: SNAPSHOT, history })
        );

        expect(result?.asOf).toBe('2026-11-05');
        expect(result?.points).toEqual(history);
    });

    it('하한 미만이면 null이다', () => {
        expect(
            publishableHistory(
                hubView({
                    snapshot: SNAPSHOT,
                    history: scoredHistory(19, '2026-11-05'),
                })
            )
        ).toBeNull();
    });
});
