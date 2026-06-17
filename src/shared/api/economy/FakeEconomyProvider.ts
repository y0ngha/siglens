import type {
    EconomicCalendarEvent,
    EconomicIndicatorSeries,
    TreasuryRateSnapshot,
} from '@y0ngha/siglens-core';

import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';
import { INDICATOR_TREND_LENGTH } from '@/shared/config/economyIndicators';

/**
 * 결정적 fixture: FMP 실측 응답과 같은 형태(name+date+value)로 9종 지표를
 * 시드해 E2E·테스트가 외부 의존 없이 /economy 전 축을 검증할 수 있게 한다.
 *
 * `export` — 테스트가 동일 source-of-truth로 정확한 값을 검증하기 위함
 * (MISTAKES §Tests §13 — 결정적 fixture는 정확한 값으로 어서션).
 */
export const INDICATOR_SEEDS: Record<
    string,
    { values: number[]; startDate: string }
> = {
    federalFunds: {
        values: [3.63, 3.58, 3.55, 3.5, 3.45],
        startDate: '2026-05-01',
    },
    inflationRate: {
        values: [2.32, 2.4, 2.55, 2.6, 2.7],
        startDate: '2026-05-15',
    },
    CPI: {
        values: [333.9, 332.4, 331.2, 330.1, 328.9],
        startDate: '2026-05-01',
    },
    GDP: {
        values: [31819.5, 31500, 31200, 30950, 30700],
        startDate: '2026-01-01',
    },
    industrialProductionTotalIndex: {
        values: [102.6, 102.3, 102.1, 101.9, 101.7],
        startDate: '2026-05-01',
    },
    smoothedUSRecessionProbabilities: {
        values: [0.44, 0.5, 0.55, 0.6, 0.62],
        startDate: '2026-04-01',
    },
    unemploymentRate: {
        values: [4.3, 4.2, 4.1, 4.0, 4.0],
        startDate: '2026-05-01',
    },
    totalNonfarmPayroll: {
        values: [159001, 158800, 158600, 158450, 158200],
        startDate: '2026-05-01',
    },
    initialClaims: {
        values: [229000, 232000, 235000, 230000, 228000],
        startDate: '2026-06-06',
    },
};

function shiftDate(start: string, monthsBack: number): string {
    const [y, m, d] = start.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1 - monthsBack, d));
    return date.toISOString().slice(0, 10);
}

/** 시리즈 한 개를 결정적으로 합성 — core normalize와 동일 형태로 반환. */
function buildSeries(name: string): EconomicIndicatorSeries {
    const seed = INDICATOR_SEEDS[name];
    if (seed === undefined) {
        return { name, latest: null, previous: null, trend: [] };
    }
    const points = seed.values.map((value, i) => ({
        date: shiftDate(seed.startDate, i),
        value,
    }));
    return {
        name,
        latest: points[0],
        previous: points[1] ?? null,
        trend: points.slice(0, INDICATOR_TREND_LENGTH),
    };
}

/** E2E·테스트용 in-memory provider. 모든 메서드가 즉시 resolve. */
export class FakeEconomyProvider implements EconomyProvider {
    async getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        return buildSeries(name);
    }

    async getTreasury(): Promise<TreasuryRateSnapshot | null> {
        return { date: '2026-06-15', year2: 4.07, year10: 4.47 };
    }

    async getCalendar(
        _from: string,
        _to: string
    ): Promise<EconomicCalendarEvent[]> {
        return [
            {
                date: '2026-06-17 14:00:00',
                event: 'Fed Rate Decision',
                impact: 'High',
                actual: null,
                estimate: 3.63,
                previous: 3.63,
                unit: '%',
            },
            {
                date: '2026-06-18 12:30:00',
                event: 'CPI YoY',
                impact: 'High',
                actual: null,
                estimate: 2.3,
                previous: 2.4,
                unit: '%',
            },
            {
                date: '2026-06-20 12:30:00',
                event: 'Initial Jobless Claims',
                impact: 'Medium',
                actual: null,
                estimate: 230000,
                previous: 229000,
                unit: '',
            },
        ];
    }
}
