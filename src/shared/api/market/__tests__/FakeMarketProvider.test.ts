import { describe, it, expect } from 'vitest';
import type { GetBarsOptions } from '@y0ngha/siglens-core';
import bars from '@e2e/fixtures/bars.json';
import { FakeMarketProvider } from '@/shared/api/market/FakeMarketProvider';

describe('FakeMarketProvider', () => {
    const provider = new FakeMarketProvider();
    const options: GetBarsOptions = { symbol: 'AAPL', timeframe: '1Day' };

    describe('getBars', () => {
        it('fixture의 bars를 그대로 반환한다', async () => {
            const result = await provider.getBars(options);

            expect(result).toHaveLength(bars.length);
            expect(result[0]).toEqual(bars[0]);
            expect(result.at(-1)).toEqual(bars.at(-1));
        });
    });

    describe('getQuote', () => {
        it('마지막 bar의 close를 price로 하는 quote를 반환한다', async () => {
            const lastClose = bars.at(-1)!.close;

            const quote = await provider.getQuote('AAPL');

            expect(quote).toEqual({
                symbol: 'AAPL',
                price: lastClose,
                changesPercentage: 1.23,
                name: 'AAPL',
            });
        });

        it('symbol 인자를 symbol/name 양쪽에 반영한다', async () => {
            const quote = await provider.getQuote('TSLA');

            expect(quote?.symbol).toBe('TSLA');
            expect(quote?.name).toBe('TSLA');
        });
    });
});
