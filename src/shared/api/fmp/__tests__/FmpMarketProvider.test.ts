import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

const mockFmpGet = fmpGet as unknown as ReturnType<typeof vi.fn>;

describe('FmpMarketProvider', () => {
    const provider = new FmpMarketProvider();
    beforeEach(() => mockFmpGet.mockReset());

    it('maps intraday bars and reverses to ascending time', async () => {
        mockFmpGet.mockResolvedValueOnce([
            {
                date: '2024-01-15 09:30:00',
                open: 1,
                high: 2,
                low: 0.5,
                close: 1.5,
                volume: 100,
            },
        ]);
        const bars = await provider.getBars({
            symbol: 'AAPL',
            timeframe: '5Min',
        });
        expect(mockFmpGet).toHaveBeenCalledWith('historical-chart/5min', {
            symbol: 'AAPL',
        });
        expect(bars).toHaveLength(1);
        expect(bars[0]!.open).toBe(1);
    });

    it('returns null from getQuote when fmpGet throws', async () => {
        mockFmpGet.mockRejectedValueOnce(new Error('boom'));
        expect(await provider.getQuote('AAPL')).toBeNull();
    });

    it('maps a quote', async () => {
        mockFmpGet.mockResolvedValueOnce([
            {
                price: 10,
                open: 9,
                dayHigh: 11,
                dayLow: 8,
                volume: 5,
                timestamp: 1700000000,
                changePercentage: 1.2,
                name: 'Apple',
            },
        ]);
        const q = await provider.getQuote('AAPL');
        expect(q).toEqual({
            symbol: 'AAPL',
            price: 10,
            changesPercentage: 1.2,
            name: 'Apple',
        });
    });
});
