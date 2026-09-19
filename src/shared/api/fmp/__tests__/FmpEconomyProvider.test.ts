vi.mock('@/shared/api/fmp/httpClient');

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const mockFmpGet = vi.mocked(fmpGet);

describe('FmpEconomyProvider', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-14T03:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('getIndicator: 정규화된 latest/previous 추출', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { name: 'federalFunds', date: '2026-05-01', value: 3.63 },
            { name: 'federalFunds', date: '2026-04-01', value: 3.58 },
        ] as unknown[]);
        const series = await new FmpEconomyProvider().getIndicator(
            'federalFunds'
        );
        expect(series.name).toBe('federalFunds');
        expect(series.latest).toEqual({ date: '2026-05-01', value: 3.63 });
        expect(series.previous).toEqual({ date: '2026-04-01', value: 3.58 });
    });

    it('getIndicator: 레지스트리 unit이 "%"인 지표는 unit을 "%"로 넘긴다(매크로 브리핑 pp 포맷)', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { name: 'federalFunds', date: '2026-05-01', value: 3.63 },
        ] as unknown[]);
        const series = await new FmpEconomyProvider().getIndicator(
            'federalFunds'
        );
        expect(series.unit).toBe('%');
    });

    it('getIndicator: 레지스트리 unit이 "%"가 아닌(level-type) 지표는 unit을 넘기지 않는다', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { name: 'CPI', date: '2026-05-01', value: 330.1 },
        ] as unknown[]);
        const series = await new FmpEconomyProvider().getIndicator('CPI');
        expect(series.unit).toBeUndefined();
    });

    it('getIndicator: economic-indicators?name+to(오늘) 호출 + 24h revalidate', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getIndicator('CPI');
        // `to` 없이 호출하면 FMP가 2025-12-01에서 멈춘 진행 중 창을 돌려준다(실측) —
        // 항상 오늘 날짜를 `to`로 보내야 최신 창이 온다.
        expect(mockFmpGet).toHaveBeenCalledWith(
            'economic-indicators',
            { name: 'CPI', to: '2026-09-14' },
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('getTreasury: 최신 행의 2Y/10Y 반환', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { date: '2026-06-15', year2: 4.07, year10: 4.47 },
        ] as unknown[]);
        const snap = await new FmpEconomyProvider().getTreasury();
        expect(snap).toEqual({ date: '2026-06-15', year2: 4.07, year10: 4.47 });
    });

    it('getTreasury: treasury-rates 호출 + 24h revalidate', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getTreasury();
        expect(mockFmpGet).toHaveBeenCalledWith(
            'treasury-rates',
            {},
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('getCalendar: US 필터 + 날짜 오름차순으로 정규화', async () => {
        mockFmpGet.mockResolvedValueOnce([
            {
                date: '2026-06-18 12:30:00',
                country: 'US',
                event: 'CPI YoY',
                impact: 'High',
                previous: 2.4,
                estimate: 2.3,
                actual: null,
                unit: '%',
            },
            {
                date: '2026-06-16 23:50:00',
                country: 'JP',
                event: 'Machinery Orders',
                impact: 'Medium',
                previous: -9.4,
                estimate: 0.9,
                actual: null,
                unit: '%',
            },
        ] as unknown[]);
        const events = await new FmpEconomyProvider().getCalendar(
            '2026-06-16',
            '2026-06-30'
        );
        expect(events).toHaveLength(1);
        expect(events[0].event).toBe('CPI YoY');
    });

    it('getCalendar: from/to 그대로 전달 + 24h revalidate', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getCalendar('2026-06-16', '2026-06-30');
        expect(mockFmpGet).toHaveBeenCalledWith(
            'economic-calendar',
            { from: '2026-06-16', to: '2026-06-30' },
            { revalidate: SECONDS_PER_DAY }
        );
    });

    it('FMP throw는 그대로 전파(상위 캐시가 graceful 처리)', async () => {
        mockFmpGet.mockRejectedValueOnce(new Error('FMP boom'));
        await expect(new FmpEconomyProvider().getTreasury()).rejects.toThrow(
            'FMP boom'
        );
    });
});
