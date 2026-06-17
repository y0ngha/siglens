import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient');

import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import { fmpGet } from '@/shared/api/fmp/httpClient';

const mockFmpGet = vi.mocked(fmpGet);

describe('FmpEconomyProvider', () => {
    beforeEach(() => {
        vi.resetAllMocks();
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

    it('getIndicator: economic-indicators?name 호출 + 24h revalidate', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getIndicator('CPI');
        expect(mockFmpGet).toHaveBeenCalledWith(
            'economic-indicators',
            { name: 'CPI' },
            { revalidate: 86400 }
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
            { revalidate: 86400 }
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
            { revalidate: 86400 }
        );
    });

    it('FMP throw는 그대로 전파(상위 캐시가 graceful 처리)', async () => {
        mockFmpGet.mockRejectedValueOnce(new Error('FMP boom'));
        await expect(new FmpEconomyProvider().getTreasury()).rejects.toThrow(
            'FMP boom'
        );
    });
});
