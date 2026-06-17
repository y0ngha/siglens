import { describe, it, expect } from 'vitest';
import {
    FakeEconomyProvider,
    INDICATOR_SEEDS,
} from '@/shared/api/economy/FakeEconomyProvider';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';

/** SEED.startDate를 1개월 단위로 뒤로 이동(FakeEconomyProvider의 shiftDate와 동일 로직). */
function shiftMonth(start: string, monthsBack: number): string {
    const [y, m, d] = start.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 - monthsBack, d))
        .toISOString()
        .slice(0, 10);
}

describe('FakeEconomyProvider', () => {
    const provider = new FakeEconomyProvider();

    it.each(ECONOMY_INDICATORS.map(m => m.name))(
        '레지스트리 지표 %s — SEED의 정확한 latest/previous 값 반환',
        async name => {
            const seed = INDICATOR_SEEDS[name];
            expect(seed).toBeDefined();
            const series = await provider.getIndicator(name);
            expect(series.name).toBe(name);
            expect(series.latest).toEqual({
                date: seed.startDate,
                value: seed.values[0],
            });
            expect(series.previous).toEqual({
                date: shiftMonth(seed.startDate, 1),
                value: seed.values[1],
            });
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
