import { describe, it, expect } from 'vitest';
import type { MarketFearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { buildMarketFearGreedComparisons } from '../../lib/buildMarketFearGreedComparisons';

const BASE_DATE_MS = new Date('2020-01-01T00:00:00Z').getTime();

function isoDateAt(offsetDays: number): string {
    return new Date(BASE_DATE_MS + offsetDays * MS_PER_DAY)
        .toISOString()
        .slice(0, 10);
}

/** 인덱스마다 고유한 score를 부여해, 결과에 어떤 세션이 골라졌는지 역추적할 수 있게 한다. */
function scoredPoint(index: number): MarketFearGreedHistoryPoint {
    return { date: isoDateAt(index), score: 1000 + index, label: 'NEUTRAL' };
}

function nullPoint(index: number): MarketFearGreedHistoryPoint {
    return { date: isoDateAt(index), score: null, label: null };
}

describe('buildMarketFearGreedComparisons', () => {
    it('빈 배열 history는 빈 배열을 반환한다', () => {
        expect(buildMarketFearGreedComparisons([])).toEqual([]);
    });

    it('전부 null(warm-up)인 history는 빈 배열을 반환한다', () => {
        const history = Array.from({ length: 10 }, (_, i) => nullPoint(i));

        expect(buildMarketFearGreedComparisons(history)).toEqual([]);
    });

    // scored 세션이 단 하나뿐이면 sessionsBack(0/5/21/252) 전부가
    // `Math.max(0, latest - sessionsBack)`에서 0으로 clamp된다 — 4개 비교
    // 포인트가 key만 다르고 date/score/label은 전부 동일한 그 세션을 가리킨다.
    // (실제로 실행해 확인한 동작을 못박는다: "1년 전과 변화 없음"과 "표본이
    // 하나뿐이라 비교 불가"가 UI상 구분되지 않는다는 뜻이므로 주의.)
    it('scored 세션이 단 하나면 4개 지점 전부가 그 세션으로 collapse된다', () => {
        const history = [scoredPoint(0)];

        const result = buildMarketFearGreedComparisons(history);

        expect(result).toEqual([
            { key: 'now', ...scoredPoint(0) },
            { key: '1w', ...scoredPoint(0) },
            { key: '1m', ...scoredPoint(0) },
            { key: '1y', ...scoredPoint(0) },
        ]);
    });

    // 필터는 `score !== null && label !== null`을 함께 요구한다 — score만 있고
    // label이 null인 점(모델 상 있을 수 없어야 하지만 방어적으로)은 scored에서
    // 제외되어야, 둘 중 하나만 채워진 반쪽짜리 포인트가 오프셋 계산에
    // 섞이지 않는다.
    it('score는 있지만 label이 null인 point는 scored로 취급하지 않는다', () => {
        const oddPoint: MarketFearGreedHistoryPoint = {
            date: isoDateAt(0),
            score: 999,
            label: null,
        };
        const history = [oddPoint, scoredPoint(1), scoredPoint(2)];

        const result = buildMarketFearGreedComparisons(history);

        expect(result[0]).toEqual({ key: 'now', ...scoredPoint(2) });
        expect(result.some(p => p.date === oddPoint.date)).toBe(false);
        expect(result.some(p => p.score === 999)).toBe(false);
    });

    it('now/1w/1m/1y 순서로 정확히 4개 포인트를 반환한다', () => {
        const SCORED_COUNT = 300; // 252(1y) offset이 clamp되지 않도록 충분히 길게
        const history = Array.from({ length: SCORED_COUNT }, (_, i) =>
            scoredPoint(i)
        );
        const latest = SCORED_COUNT - 1;

        const result = buildMarketFearGreedComparisons(history);

        expect(result.map(p => p.key)).toEqual(['now', '1w', '1m', '1y']);
        expect(result[0]).toEqual({ key: 'now', ...scoredPoint(latest) });
        expect(result[1]).toEqual({ key: '1w', ...scoredPoint(latest - 5) });
        expect(result[2]).toEqual({ key: '1m', ...scoredPoint(latest - 21) });
        expect(result[3]).toEqual({ key: '1y', ...scoredPoint(latest - 252) });
    });

    it('워밍업(null 점수) 구간을 건너뛰고 scored 세션만으로 오프셋을 센다', () => {
        const WARM_UP = 30;
        const SCORED_COUNT = 300;
        const warmUp = Array.from({ length: WARM_UP }, (_, i) => nullPoint(i));
        const scored = Array.from({ length: SCORED_COUNT }, (_, i) =>
            scoredPoint(WARM_UP + i)
        );
        const history = [...warmUp, ...scored];

        const result = buildMarketFearGreedComparisons(history);
        const oneYearAgo = result.find(p => p.key === '1y');

        // scored 배열 기준 1y offset(252) → scored[300-1-252] = scored[47],
        // 즉 워밍업 30개를 지난 세션이어야 한다(워밍업 안이었다면 index<30).
        const expectedInScored = SCORED_COUNT - 1 - 252;
        expect(oneYearAgo).toEqual({
            key: '1y',
            ...scoredPoint(WARM_UP + expectedInScored),
        });
        expect(warmUp.some(p => p.date === oneYearAgo?.date)).toBe(false);
        expect(oneYearAgo?.score).not.toBeNull();
    });

    it('scored 세션이 252개 미만이면 가장 이른 scored 세션으로 clamp하고, date도 그 세션을 반영한다', () => {
        const SCORED_COUNT = 100; // < 252
        const history = Array.from({ length: SCORED_COUNT }, (_, i) =>
            scoredPoint(i)
        );

        const result = buildMarketFearGreedComparisons(history);
        const oneYearAgo = result.find(p => p.key === '1y');

        // Math.max(0, 99 - 252) = 0 → 가장 이른 scored 세션(index 0)으로 clamp.
        expect(oneYearAgo).toEqual({ key: '1y', ...scoredPoint(0) });
    });
});
