import { getSurpriseBadge } from '@/widgets/news/utils/surpriseBadge';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

const BASE: EarningsReportComparisonItem = {
    symbol: 'AAPL',
    earningsDate: '2026-04-30',
    epsActual: 2.1,
    epsEstimated: 2,
    revenueActual: null,
    revenueEstimated: null,
    lastUpdated: '2026-05-10',
    period: 'past',
    slot: 'past-1',
};

describe('getSurpriseBadge', () => {
    it('예정 항목은 배지가 없다', () => {
        expect(getSurpriseBadge({ ...BASE, period: 'future' })).toBeNull();
    });

    it('+2% 이상이면 surprise, -2% 이하면 shock, 그 사이는 inline이다', () => {
        expect(getSurpriseBadge(BASE)?.kind).toBe('surprise');
        expect(getSurpriseBadge({ ...BASE, epsActual: 1.9 })?.kind).toBe(
            'shock'
        );
        expect(getSurpriseBadge({ ...BASE, epsActual: 2.01 })?.kind).toBe(
            'inline'
        );
    });

    it('EPS 괴리를 못 구하면 매출 괴리로 대체한다', () => {
        const badge = getSurpriseBadge({
            ...BASE,
            epsActual: null,
            revenueActual: 110,
            revenueEstimated: 100,
        });
        expect(badge?.kind).toBe('surprise');
        expect(badge?.percent).toBeCloseTo(10);
    });

    it('추정치가 0이거나 값이 없으면 null이다', () => {
        expect(getSurpriseBadge({ ...BASE, epsEstimated: 0 })).toBeNull();
        expect(getSurpriseBadge({ ...BASE, epsActual: null })).toBeNull();
    });
});
