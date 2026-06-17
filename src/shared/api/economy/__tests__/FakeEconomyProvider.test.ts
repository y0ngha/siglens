import { describe, it, expect } from 'vitest';
import { FakeEconomyProvider } from '@/shared/api/economy/FakeEconomyProvider';

/**
 * 결정적 fixture 검증 — FakeEconomyProvider의 SEED와 동일 값으로 하드코딩한다.
 * 프로덕션 로직(`shiftDate`)을 재구현하면 같은 버그가 양쪽에 있어도 통과되는
 * 동어반복 위험(MISTAKES §13.5)이라, latest/previous를 명시 expected로 박는다.
 */
const EXPECTED_FIXTURES: Record<
    string,
    {
        latest: { date: string; value: number };
        previous: { date: string; value: number };
    }
> = {
    federalFunds: {
        latest: { date: '2026-05-01', value: 3.63 },
        previous: { date: '2026-04-01', value: 3.58 },
    },
    inflationRate: {
        latest: { date: '2026-05-15', value: 2.32 },
        previous: { date: '2026-04-15', value: 2.4 },
    },
    CPI: {
        latest: { date: '2026-05-01', value: 333.9 },
        previous: { date: '2026-04-01', value: 332.4 },
    },
    GDP: {
        latest: { date: '2026-01-01', value: 31819.5 },
        previous: { date: '2025-12-01', value: 31500 },
    },
    industrialProductionTotalIndex: {
        latest: { date: '2026-05-01', value: 102.6 },
        previous: { date: '2026-04-01', value: 102.3 },
    },
    smoothedUSRecessionProbabilities: {
        latest: { date: '2026-04-01', value: 0.44 },
        previous: { date: '2026-03-01', value: 0.5 },
    },
    unemploymentRate: {
        latest: { date: '2026-05-01', value: 4.3 },
        previous: { date: '2026-04-01', value: 4.2 },
    },
    totalNonfarmPayroll: {
        latest: { date: '2026-05-01', value: 159001 },
        previous: { date: '2026-04-01', value: 158800 },
    },
    initialClaims: {
        latest: { date: '2026-06-06', value: 229000 },
        previous: { date: '2026-05-06', value: 232000 },
    },
};

describe('FakeEconomyProvider', () => {
    const provider = new FakeEconomyProvider();

    it.each(Object.entries(EXPECTED_FIXTURES))(
        '레지스트리 지표 %s — SEED의 정확한 latest/previous 값 반환',
        async (name, expected) => {
            const series = await provider.getIndicator(name);
            expect(series.name).toBe(name);
            expect(series.latest).toEqual(expected.latest);
            expect(series.previous).toEqual(expected.previous);
        }
    );

    it('미지정 지표는 빈 시리즈로 graceful', async () => {
        const series = await provider.getIndicator('unknownIndicator');
        expect(series.latest).toBeNull();
        expect(series.previous).toBeNull();
        expect(series.trend).toEqual([]);
    });

    it('getTreasury: 결정적 2Y/10Y 반환', async () => {
        expect(await provider.getTreasury()).toEqual({
            date: '2026-06-15',
            year2: 4.07,
            year10: 4.47,
        });
    });

    it('getCalendar: 결정적 US 이벤트 fixture를 반환', async () => {
        const events = await provider.getCalendar('2026-06-16', '2026-06-30');
        // Fake는 country 필드 없는 US-only 사전 정규화 데이터로 시드됨.
        const eventNames = events.map(e => e.event);
        expect(eventNames).toEqual([
            'Fed Rate Decision',
            'CPI YoY',
            'Initial Jobless Claims',
        ]);
    });

    it('지표 시계열은 최신→과거 정렬', async () => {
        const series = await provider.getIndicator('federalFunds');
        const dates = series.trend.map(p => p.date);
        const sorted = dates.toSorted((a, b) => (a < b ? 1 : -1));
        expect(dates).toEqual(sorted);
    });
});
