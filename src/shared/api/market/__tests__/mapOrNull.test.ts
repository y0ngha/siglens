import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapOrNull } from '@/shared/api/market/mapOrNull';

describe('mapOrNull', () => {
    afterEach(() => vi.restoreAllMocks());

    it('매핑이 성공하면 그 값을 돌려준다', () => {
        expect(
            mapOrNull('FmpMarketProvider', 'getQuote', 'AAPL', () => 42)
        ).toBe(42);
    });

    it('매핑이 던지면 null을 돌려주고 어댑터·매핑·심볼을 담아 경고한다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = new Error('bad timestamp');

        expect(
            mapOrNull('YahooMarketProvider', 'today-quote', '005930.KS', () => {
                throw error;
            })
        ).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            '[YahooMarketProvider] today-quote mapping failed:',
            '005930.KS',
            error
        );
    });
});
