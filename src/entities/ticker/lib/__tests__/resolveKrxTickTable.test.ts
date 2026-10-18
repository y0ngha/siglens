const getQuoteTypeOrThrow = vi.fn();

vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: class {
        getQuoteTypeOrThrow = getQuoteTypeOrThrow;
    },
}));

// getOrSetCache의 계약(성공한 fetcher 결과만 저장, 던지면 전파)을 메모리 맵으로 재현한다.
const store = new Map<string, unknown>();
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async <T>(
        key: string,
        _ttl: number,
        fetcher: () => Promise<T>
    ): Promise<T> => {
        // 이 맵에는 같은 키로 이 fetcher가 돌려준 `T`만 저장된다(아래 `store.set`) — 키가 타입을 정한다.
        if (store.has(key)) return store.get(key) as T;
        const value = await fetcher();
        store.set(key, value);
        return value;
    },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    resolveKrxTickTable,
    resolveKrxTickTableForDisplay,
} from '../resolveKrxTickTable';

describe('resolveKrxTickTable', () => {
    beforeEach(() => {
        store.clear();
        getQuoteTypeOrThrow.mockReset();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('returns share for a non-KR symbol without any lookup', async () => {
        expect(await resolveKrxTickTable('AAPL')).toBe('share');
        expect(getQuoteTypeOrThrow).not.toHaveBeenCalled();
        expect(store.size).toBe(0);
    });

    it('returns share in E2E without any lookup', async () => {
        vi.stubEnv('E2E_TEST', '1');
        expect(await resolveKrxTickTable('360750.KS')).toBe('share');
        expect(getQuoteTypeOrThrow).not.toHaveBeenCalled();
    });

    it('maps quoteType ETF to etp', async () => {
        getQuoteTypeOrThrow.mockResolvedValue('ETF');
        expect(await resolveKrxTickTable('360750.KS')).toBe('etp');
    });

    it('maps quoteType ETN to etp', async () => {
        getQuoteTypeOrThrow.mockResolvedValue('ETN');
        expect(await resolveKrxTickTable('500001.KS')).toBe('etp');
    });

    it('maps quoteType EQUITY to share', async () => {
        getQuoteTypeOrThrow.mockResolvedValue('EQUITY');
        expect(await resolveKrxTickTable('005930.KS')).toBe('share');
    });

    it('retries a transient yahoo failure once before deciding', async () => {
        getQuoteTypeOrThrow
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce('ETF');
        expect(await resolveKrxTickTable('360750.KS')).toBe('etp');
        expect(getQuoteTypeOrThrow).toHaveBeenCalledTimes(2);
    });

    it('throws instead of guessing share when yahoo keeps failing, and caches nothing', async () => {
        // A guessed share table would be written under core's shared analysis
        // cache key for an ETF until its TTL.
        getQuoteTypeOrThrow.mockRejectedValue(new Error('network'));
        await expect(resolveKrxTickTable('360750.KS')).rejects.toThrow(
            'network'
        );
        expect(getQuoteTypeOrThrow).toHaveBeenCalledTimes(2);
        expect(store.size).toBe(0);
    });

    it('throws when yahoo has no quote for the symbol', async () => {
        getQuoteTypeOrThrow.mockResolvedValue(null);
        await expect(resolveKrxTickTable('999999.KS')).rejects.toThrow();
        expect(store.size).toBe(0);
    });

    it('the display variant falls back to share on failure, then recovers', async () => {
        getQuoteTypeOrThrow.mockRejectedValue(new Error('network'));
        expect(await resolveKrxTickTableForDisplay('360750.KS')).toBe('share');
        expect(store.size).toBe(0);

        getQuoteTypeOrThrow.mockReset();
        getQuoteTypeOrThrow.mockResolvedValue('ETF');
        expect(await resolveKrxTickTableForDisplay('360750.KS')).toBe('etp');
    });

    it('serves a cached value without calling yahoo again', async () => {
        getQuoteTypeOrThrow.mockResolvedValue('ETF');
        expect(await resolveKrxTickTable('360750.KS')).toBe('etp');
        getQuoteTypeOrThrow.mockClear();

        expect(await resolveKrxTickTable('360750.ks')).toBe('etp');
        expect(getQuoteTypeOrThrow).not.toHaveBeenCalled();
    });
});
