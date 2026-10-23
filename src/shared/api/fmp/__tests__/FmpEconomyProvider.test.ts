vi.mock('@/shared/api/fmp/httpClient');

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    FmpEconomyProvider,
    splitCalendarRange,
} from '@/shared/api/fmp/FmpEconomyProvider';
import { fmpGet } from '@/shared/api/fmp/httpClient';

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

    it('getIndicator: economic-indicators?name+to(오늘) 호출, 캐시 옵션 없음', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getIndicator('CPI');
        // `to` 없이 호출하면 FMP가 2025-12-01에서 멈춘 진행 중 창을 돌려준다(실측) —
        // 항상 오늘 날짜를 `to`로 보내야 최신 창이 온다.
        expect(mockFmpGet).toHaveBeenCalledWith('economic-indicators', {
            name: 'CPI',
            to: '2026-09-14',
        });
    });

    it('getTreasury: 최신 행의 2Y/10Y 반환', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { date: '2026-06-15', year2: 4.07, year10: 4.47 },
        ] as unknown[]);
        const snap = await new FmpEconomyProvider().getTreasury();
        expect(snap).toEqual({ date: '2026-06-15', year2: 4.07, year10: 4.47 });
    });

    it('getTreasury: treasury-rates 호출, 캐시 옵션 없음', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getTreasury();
        expect(mockFmpGet).toHaveBeenCalledWith('treasury-rates');
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

    it('getCalendar: from/to 그대로 전달, 캐시 옵션 없음', async () => {
        mockFmpGet.mockResolvedValueOnce([] as unknown[]);
        await new FmpEconomyProvider().getCalendar('2026-06-16', '2026-06-30');
        expect(mockFmpGet).toHaveBeenCalledWith('economic-calendar', {
            from: '2026-06-16',
            to: '2026-06-30',
        });
    });

    it('getCalendarForCountry: 90일보다 긴 범위는 나눠 읽고 행을 이어 붙인다', async () => {
        // FMP는 `to`로 끝나는 90일만 돌려준다 — 한 번에 읽으면 앞쪽이 조용히 빠진다.
        mockFmpGet.mockImplementation(async (_path, params) => {
            const { from } = params as { from: string; to: string };
            if (from === '2026-04-26')
                return [
                    {
                        country: 'KR',
                        date: '2026-04-27 21:00:00',
                        event: 'Old',
                        impact: 'High',
                    },
                ];
            if (from === '2026-07-25') return { error: 'not an array' };
            return [
                {
                    country: 'KR',
                    date: '2026-10-26 02:30:00',
                    event: 'New',
                    impact: 'High',
                },
            ];
        });
        const events = await new FmpEconomyProvider().getCalendarForCountry(
            '2026-04-26',
            '2026-11-22',
            'KR'
        );
        expect(mockFmpGet).toHaveBeenCalledTimes(3);
        expect(mockFmpGet).toHaveBeenCalledWith('economic-calendar', {
            from: '2026-04-26',
            to: '2026-07-24',
        });
        expect(mockFmpGet).toHaveBeenCalledWith('economic-calendar', {
            from: '2026-07-25',
            to: '2026-10-22',
        });
        expect(mockFmpGet).toHaveBeenCalledWith('economic-calendar', {
            from: '2026-10-23',
            to: '2026-11-22',
        });
        // 배열이 아닌 조각은 빈 것으로 보고 나머지는 남긴다.
        expect(events.map(e => e.event)).toEqual(['Old', 'New']);
    });

    it('FMP throw는 그대로 전파(상위 캐시가 graceful 처리)', async () => {
        mockFmpGet.mockRejectedValueOnce(new Error('FMP boom'));
        await expect(new FmpEconomyProvider().getTreasury()).rejects.toThrow(
            'FMP boom'
        );
    });
});

describe('splitCalendarRange', () => {
    it('90일 이하는 한 조각 그대로', () => {
        expect(splitCalendarRange('2026-10-23', '2027-01-20')).toEqual([
            { from: '2026-10-23', to: '2027-01-20' },
        ]);
    });

    it('91일이면 90일 + 1일 두 조각, 경계 날짜가 겹치지 않는다', () => {
        expect(splitCalendarRange('2026-10-23', '2027-01-21')).toEqual([
            { from: '2026-10-23', to: '2027-01-20' },
            { from: '2027-01-21', to: '2027-01-21' },
        ]);
    });

    it('하루짜리와 거꾸로 된 범위는 그대로 한 조각', () => {
        expect(splitCalendarRange('2026-10-23', '2026-10-23')).toEqual([
            { from: '2026-10-23', to: '2026-10-23' },
        ]);
        expect(splitCalendarRange('2026-10-24', '2026-10-23')).toEqual([
            { from: '2026-10-24', to: '2026-10-23' },
        ]);
    });
});
