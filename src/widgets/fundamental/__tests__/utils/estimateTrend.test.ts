import { describe, expect, it } from 'vitest';
import type { AnalystEstimatePeriod } from '@/entities/analyst-views/model';
import {
    estimateChangeDirection,
    revisionShare,
    visibleEstimatePeriods,
} from '@/widgets/fundamental/utils/estimateTrend';

function row(
    period: string,
    avg: number | null,
    up30d: number | null = null,
    down30d: number | null = null
): AnalystEstimatePeriod {
    return {
        period,
        endDate: null,
        eps: {
            avg,
            analysts: null,
            ago7d: null,
            ago30d: null,
            ago60d: null,
            ago90d: null,
            change30d: null,
            change90d: null,
        },
        revisions: { up7d: null, down7d: null, up30d, down30d },
        revenue: { avg: null, analysts: null, growthPct: null },
    };
}

describe('estimateTrend utils', () => {
    it('EPS 추정치가 있는 기간만 이번 분기→다음 분기→올해→내년 순으로, 모르는 기간 코드는 뺀다', () => {
        expect(
            visibleEstimatePeriods([
                row('+1y', 5),
                row('0y', null),
                row('+1q', 1.2),
                row('0q', 1.1),
                row('+5y', 9),
            ]).map(r => r.period)
        ).toEqual(['0q', '+1q', '+1y']);
    });

    it('적자 EPS의 개선(−4.1 → −2.2)도 상승이고, 표시 단위에서 0이면 변화 없음이다', () => {
        expect(estimateChangeDirection(-2.2 - -4.1, false)).toBe('up');
        expect(estimateChangeDirection(-0.3, false)).toBe('down');
        expect(estimateChangeDirection(-0.002, true)).toBe('flat');
        expect(estimateChangeDirection(0, false)).toBe('flat');
    });

    it('상향·하향 비율은 합 100이고, 둘 다 없으면 null이다', () => {
        expect(revisionShare(row('0q', 1, 2, 1))).toEqual({
            up: 2,
            down: 1,
            upPct: 67,
            downPct: 33,
        });
        expect(revisionShare(row('0q', 1, 0, 0))).toBeNull();
        expect(revisionShare(row('0q', 1))).toBeNull();
    });
});
