import { describe, it, expect } from 'vitest';
import { FakeEconomyProvider } from '@/shared/api/economy/FakeEconomyProvider';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';

describe('FakeEconomyProvider', () => {
    const provider = new FakeEconomyProvider();

    it('레지스트리 9종 지표 모두 시드된 값을 반환', async () => {
        for (const meta of ECONOMY_INDICATORS) {
            const series = await provider.getIndicator(meta.name);
            expect(series.name).toBe(meta.name);
            expect(series.latest).not.toBeNull();
            expect(series.previous).not.toBeNull();
        }
    });

    it('federalFunds fixture는 결정적 값 반환', async () => {
        const series = await provider.getIndicator('federalFunds');
        expect(series.latest).toEqual({ date: '2026-05-01', value: 3.63 });
        expect(series.previous).toEqual({ date: '2026-04-01', value: 3.58 });
    });

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
