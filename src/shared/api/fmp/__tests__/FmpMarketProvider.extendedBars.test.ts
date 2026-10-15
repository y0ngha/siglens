import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import extended1Hour from './fixtures/extendedBars.aapl.1hour.json';
import extended5Min from './fixtures/extendedBars.aapl.5min.json';

const mockFmpGet = vi.mocked(fmpGet);

describe('FmpMarketProvider.getExtendedBars', () => {
    const provider = new FmpMarketProvider();

    beforeEach(() => {
        mockFmpGet.mockReset();
        // 거부형 기본값: 어떤 테스트도 실제 FMP로 새어 나가지 못한다.
        mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('network must not be used'))
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('intraday 요청에 extended=true를 붙인다', async () => {
        mockFmpGet.mockResolvedValue(extended1Hour);
        await provider.getExtendedBars({
            symbol: 'AAPL',
            timeframe: '1Hour',
            from: '2026-10-14T00:00:00Z',
            before: '2026-10-15T00:00:00Z',
        });
        expect(mockFmpGet).toHaveBeenCalledWith('historical-chart/1hour', {
            symbol: 'AAPL',
            from: '2026-10-14',
            to: '2026-10-15',
            extended: 'true',
        });
    });

    it.each([
        ['5Min', '5min'],
        ['15Min', '15min'],
        ['30Min', '30min'],
        ['1Hour', '1hour'],
        ['4Hour', '4hour'],
    ] as const)('%s → historical-chart/%s', async (timeframe, path) => {
        mockFmpGet.mockResolvedValue([]);
        await provider.getExtendedBars({
            symbol: 'AAPL',
            timeframe,
            from: '2026-10-14',
        });
        expect(mockFmpGet).toHaveBeenCalledWith(`historical-chart/${path}`, {
            symbol: 'AAPL',
            from: '2026-10-14',
            extended: 'true',
        });
    });

    it('1Day는 FMP를 부르지 않고 빈 배열이다(일봉 엔드포인트는 extended를 무시한다)', async () => {
        const result = await provider.getExtendedBars({
            symbol: 'AAPL',
            timeframe: '1Day',
            from: '2026-10-01',
        });
        expect(result).toEqual([]);
        expect(mockFmpGet).not.toHaveBeenCalled();
    });

    it('실제 응답(최신순 04:00~19:55 ET)을 시각 오름차순 UTC 초로 바꾼다', async () => {
        mockFmpGet.mockResolvedValue(extended5Min);
        const bars = await provider.getExtendedBars({
            symbol: 'AAPL',
            timeframe: '5Min',
            from: '2026-10-14',
        });
        expect(bars).toHaveLength(192);
        // 2026-10-14은 EDT(UTC−4): 04:00 ET = 08:00Z, 19:55 ET = 23:55Z
        expect(bars[0]!.time).toBe(Date.UTC(2026, 9, 14, 8, 0) / 1000);
        expect(bars.at(-1)!.time).toBe(Date.UTC(2026, 9, 14, 23, 55) / 1000);
        expect(bars.map(b => b.time)).toEqual(
            bars.map(b => b.time).toSorted((a, b) => a - b)
        );
    });

    it('비배열 응답은 빈 배열이다', async () => {
        mockFmpGet.mockResolvedValue({ 'Error Message': 'x' });
        expect(
            await provider.getExtendedBars({
                symbol: 'AAPL',
                timeframe: '5Min',
                from: '2026-10-14',
            })
        ).toEqual([]);
    });

    it('FMP 오류는 전파된다(캐시 계층이 굳히지 않게)', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP 429'));
        await expect(
            provider.getExtendedBars({
                symbol: 'AAPL',
                timeframe: '5Min',
                from: '2026-10-14',
            })
        ).rejects.toThrow('FMP 429');
    });

    describe('정규장 getBars는 그대로다', () => {
        it('extended 인자를 붙이지 않는다', async () => {
            mockFmpGet.mockResolvedValue([]);
            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Hour',
                from: '2026-10-14T00:00:00Z',
            });
            expect(mockFmpGet).toHaveBeenCalledWith('historical-chart/1hour', {
                symbol: 'AAPL',
                from: '2026-10-14',
            });
        });
    });
});
