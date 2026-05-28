import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

const mockFmpGet = fmpGet as unknown as ReturnType<typeof vi.fn>;

/** Build a minimal FmpOhlcvBar shape for mocks. */
function makeOhlcvBar(
    date: string,
    overrides?: Partial<{
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }>
) {
    return {
        date,
        open: overrides?.open ?? 100,
        high: overrides?.high ?? 110,
        low: overrides?.low ?? 90,
        close: overrides?.close ?? 105,
        volume: overrides?.volume ?? 1000,
    };
}

/** Build a minimal FmpQuote shape for mocks. */
function makeQuote(timestampSec: number) {
    return {
        price: 150,
        open: 145,
        dayHigh: 155,
        dayLow: 140,
        volume: 5000,
        timestamp: timestampSec,
        changePercentage: 1.5,
        name: 'Apple',
    };
}

describe('FmpMarketProvider', () => {
    const provider = new FmpMarketProvider();
    beforeEach(() => mockFmpGet.mockReset());

    // ── existing tests ─────────────────────────────────────────────────────────

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

    // ── B5: daily getBars ───────────────────────────────────────────────────────

    describe('getBars("1Day")', () => {
        it('happy path: EOD bars mapped + sorted ascending, UTC midnight time', async () => {
            // endDate provided → today-quote skipped
            mockFmpGet.mockResolvedValueOnce([
                makeOhlcvBar('2026-04-15'),
                makeOhlcvBar('2026-04-14'),
            ]);

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                before: '2026-04-16T00:00:00Z',
            });

            expect(mockFmpGet).toHaveBeenCalledTimes(1);
            expect(bars).toHaveLength(2);
            // ascending order (oldest first)
            expect(bars[0]!.time).toBeLessThan(bars[1]!.time);
            // UTC midnight assertion (TZ fix)
            expect(bars[0]!.time).toBe(Date.UTC(2026, 3, 14) / 1000); // 2026-04-14
            expect(bars[1]!.time).toBe(Date.UTC(2026, 3, 15) / 1000); // 2026-04-15
        });

        it('today-quote MERGE: no endDate, EOD last bar older than today-quote → today bar appended last', async () => {
            // EOD returns one older bar; quote is from a later day
            const eodDateStr = '2026-04-14';
            // today quote timestamp is 2026-04-15T14:00:00Z
            const todayTimestampSec = Math.floor(
                Date.UTC(2026, 3, 15, 14, 0, 0) / 1000
            );

            mockFmpGet
                .mockResolvedValueOnce([makeOhlcvBar(eodDateStr)])
                .mockResolvedValueOnce([makeQuote(todayTimestampSec)]);

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            expect(bars).toHaveLength(2);
            // first bar is the EOD bar at UTC midnight of eodDateStr
            expect(bars[0]!.time).toBe(Date.UTC(2026, 3, 14) / 1000);
            // last bar is the today-quote bar at UTC midnight of 2026-04-15
            expect(bars[1]!.time).toBe(Date.UTC(2026, 3, 15) / 1000);
        });

        it('today-quote SKIP: last EOD bar.time >= today bar.time → not appended', async () => {
            // EOD's last bar is same day as the today-quote
            const sameDayStr = '2026-04-15';
            const todayTimestampSec = Math.floor(
                Date.UTC(2026, 3, 15, 14, 0, 0) / 1000
            );

            mockFmpGet
                .mockResolvedValueOnce([makeOhlcvBar(sameDayStr)])
                .mockResolvedValueOnce([makeQuote(todayTimestampSec)]);

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            // today-quote has same time as last EOD bar → not appended
            expect(bars).toHaveLength(1);
            expect(bars[0]!.time).toBe(Date.UTC(2026, 3, 15) / 1000);
        });

        it('endDate provided → today-quote NOT requested (fmpGet called once for daily)', async () => {
            mockFmpGet.mockResolvedValueOnce([makeOhlcvBar('2026-04-14')]);

            await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
                before: '2026-04-15T00:00:00Z',
            });

            // Only one fmpGet call (EOD); no second call for quote
            expect(mockFmpGet).toHaveBeenCalledTimes(1);
        });

        it('non-array response → [] returned', async () => {
            mockFmpGet.mockResolvedValueOnce({});

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            expect(bars).toEqual([]);
        });

        it('getBars("1Day") with no endDate where quote fmpGet rejects → returns EOD bars (today-quote degrades gracefully)', async () => {
            mockFmpGet
                .mockResolvedValueOnce([makeOhlcvBar('2026-04-14')])
                .mockRejectedValueOnce(new Error('network error'));

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '1Day',
            });

            // Today-quote fetch failed → degrades to null, only EOD bars returned
            expect(bars).toHaveLength(1);
            expect(bars[0]!.time).toBe(Date.UTC(2026, 3, 14) / 1000);
        });
    });

    // ── B5: intraday getBars ────────────────────────────────────────────────────

    describe('getBars(intraday)', () => {
        it('empty array → [] returned', async () => {
            mockFmpGet.mockResolvedValueOnce([]);

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
            });

            expect(bars).toEqual([]);
        });

        it('non-array response → [] returned', async () => {
            mockFmpGet.mockResolvedValueOnce({});

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '15Min',
            });

            expect(bars).toEqual([]);
        });

        /**
         * DST-boundary test: one bar in EDT (UTC-4) and one in EST (UTC-5).
         * The 09:30 ET candle should map to different UTC seconds depending on
         * which timezone offset applies.
         *
         * EDT example:  2024-07-01 09:30:00 ET  → 2024-07-01 13:30:00 UTC
         * EST example:  2024-01-15 09:30:00 ET  → 2024-01-15 14:30:00 UTC
         *
         * Difference = 1 hour = 3600 seconds.
         */
        it('DST-boundary: EDT bar and EST bar at the same clock time have UTC offsets differing by 3600s', async () => {
            const edtBar = makeOhlcvBar('2024-07-01 09:30:00'); // summer → EDT (UTC-4)
            const estBar = makeOhlcvBar('2024-01-15 09:30:00'); // winter → EST (UTC-5)

            // FMP returns descending (newer first): edtBar (Jul) before estBar (Jan)
            mockFmpGet.mockResolvedValueOnce([edtBar, estBar]);

            const bars = await provider.getBars({
                symbol: 'AAPL',
                timeframe: '5Min',
            });

            expect(bars).toHaveLength(2);
            // after .toReversed(): ascending → estBar (Jan) first, edtBar (Jul) second
            const estTime = bars[0]!.time;
            const edtTime = bars[1]!.time;

            // EDT: 2024-07-01 09:30 ET = 13:30 UTC
            expect(edtTime).toBe(
                Math.floor(Date.UTC(2024, 6, 1, 13, 30, 0) / 1000)
            );
            // EST: 2024-01-15 09:30 ET = 14:30 UTC
            expect(estTime).toBe(
                Math.floor(Date.UTC(2024, 0, 15, 14, 30, 0) / 1000)
            );

            // The UTC offsets differ by exactly 3600 seconds (DST rule)
            expect(edtTime - estTime).toBe(
                Math.floor(
                    (Date.UTC(2024, 6, 1, 13, 30, 0) -
                        Date.UTC(2024, 0, 15, 14, 30, 0)) /
                        1000
                )
            );
        });
    });
});
