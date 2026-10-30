import {
    dedupeEarningsReportInputs,
    upcomingUnreportedDates,
} from '../../lib/earningsUpsertInputs';
import type { EarningsReportUpsertInput } from '../../model';

const rawPayload = {
    date: '2025-08-01',
    symbol: 'AAPL',
    eps: 1.53,
    revenue: 90_000_000_000,
};

const upcomingInput: EarningsReportUpsertInput = {
    symbol: 'COP',
    earningsDate: '2026-11-05',
    epsActual: null,
    epsEstimated: 1.4,
    revenueActual: null,
    revenueEstimated: null,
    lastUpdated: '2026-10-21',
    rawPayload: {},
};

const reportInput: EarningsReportUpsertInput = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: 1.53,
    epsEstimated: 1.48,
    revenueActual: 90_000_000_000,
    revenueEstimated: 89_500_000_000,
    lastUpdated: '2025-08-02',
    rawPayload,
};

// --- DB mock helpers ---

describe('upcomingUnreportedDates', () => {
    it('기준일 이후 실적 미발표 행의 날짜만 고른다', () => {
        expect(
            upcomingUnreportedDates(
                [
                    upcomingInput,
                    { ...upcomingInput, earningsDate: '2026-10-21' },
                    {
                        ...upcomingInput,
                        earningsDate: '2026-12-01',
                        revenueActual: 1,
                    },
                ],
                '2026-10-22'
            )
        ).toEqual(['2026-11-05']);
    });
});

describe('dedupeEarningsReportInputs', () => {
    it('lastUpdated 가 같으면 값이 더 많이 채워진 항목을 남긴다', () => {
        const sparse: EarningsReportUpsertInput = {
            ...reportInput,
            epsActual: null,
            revenueActual: null,
        };

        expect(dedupeEarningsReportInputs([reportInput, sparse])).toEqual([
            reportInput,
        ]);
    });

    it('lastUpdated 와 populated count 가 동일하면 후순위 항목으로 교체', () => {
        const first: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: '2025-08-02',
        };
        const second: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: '2025-08-02',
        };

        const result = dedupeEarningsReportInputs([first, second]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(second);
    });

    it('candidate lastUpdated null 이면 교체하지 않는다', () => {
        const existing: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: '2025-08-01',
        };
        const candidate: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: null,
        };

        const result = dedupeEarningsReportInputs([existing, candidate]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(existing);
    });

    it('existing lastUpdated null 이고 candidate 는 non-null 이면 교체', () => {
        const existing: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: null,
        };
        const candidate: EarningsReportUpsertInput = {
            ...reportInput,
            lastUpdated: '2025-08-02',
        };

        const result = dedupeEarningsReportInputs([existing, candidate]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(candidate);
    });
});

// upsertMany 가 DB_TRANSIENT_RETRY 정책을 실제로 통과시키는지 확인하는
// smoke 테스트. withRetry/isTransientDbError 자체의 동작은 각자의
// 단위 테스트에서 검증하므로 여기서는 "정책이 wire-up 됐다"만 보장한다.
