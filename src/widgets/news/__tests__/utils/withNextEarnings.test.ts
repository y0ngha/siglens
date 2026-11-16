import { describe, expect, it } from 'vitest';
import type { AnalystEarningsHint } from '@/entities/analyst-views/model';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { withNextEarnings } from '../../utils/withNextEarnings';

function item(
    over: Partial<EarningsReportComparisonItem>
): EarningsReportComparisonItem {
    return {
        symbol: 'NVDA',
        earningsDate: '2026-08-27',
        epsActual: 1.05,
        epsEstimated: 1.01,
        revenueActual: 46_700_000_000,
        revenueEstimated: 46_000_000_000,
        lastUpdated: '2026-08-28',
        period: 'past',
        slot: 'past-1',
        ...over,
    };
}

const FUTURE = item({
    earningsDate: '2026-11-20',
    epsActual: null,
    revenueActual: null,
    period: 'future',
    slot: 'recent-or-future',
});

const CONFIRMED: AnalystEarningsHint = {
    date: '2026-11-19',
    isEstimate: false,
    session: 'after_market',
    callAt: null,
};

describe('withNextEarnings', () => {
    it('다음 실적을 Yahoo 확정일·세션으로 바꾸고 지난 실적은 건드리지 않는다', () => {
        const past = item({});
        expect(
            withNextEarnings([past, FUTURE], CONFIRMED, '2026-11-16')
        ).toEqual([
            { ...past, confirmed: null, session: null },
            {
                ...FUTURE,
                earningsDate: '2026-11-19',
                confirmed: true,
                session: 'after_market',
            },
        ]);
    });

    it('Yahoo가 추정이라고 하면 날짜는 그대로, 확정 여부는 false, 세션은 싣지 않는다', () => {
        const [out] = withNextEarnings(
            [FUTURE],
            { ...CONFIRMED, date: '2026-11-20', isEstimate: true },
            '2026-11-16'
        );
        expect(out).toMatchObject({
            earningsDate: '2026-11-20',
            confirmed: false,
            session: null,
        });
    });

    it('힌트가 없으면 다음 실적도 그대로이고 확정 여부는 모름(null)이다', () => {
        expect(withNextEarnings([FUTURE], null, '2026-11-16')).toEqual([
            { ...FUTURE, confirmed: null, session: null },
        ]);
    });
});
