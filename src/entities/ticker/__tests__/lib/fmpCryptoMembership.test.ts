import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- hoisted mocks ----
const { getOrSetCacheMock, fetchCryptoAssetListMock } = vi.hoisted(() => ({
    getOrSetCacheMock: vi.fn(),
    fetchCryptoAssetListMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: getOrSetCacheMock,
}));
vi.mock('@/shared/config/time', () => ({
    SECONDS_PER_DAY: 86400,
}));
vi.mock('../../api', () => ({
    fetchCryptoAssetList: fetchCryptoAssetListMock,
}));

import {
    getFmpCryptoListMap,
    fmpCryptoMembership,
} from '../../lib/fmpCryptoMembership';

describe('getFmpCryptoListMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a Map built from the cached FMP list record', async () => {
        // getOrSetCache returns the already-serialized Record (as it would from Redis)
        getOrSetCacheMock.mockImplementation(
            async (
                _key: string,
                _ttl: number,
                fetcher: () => Promise<unknown>
            ) => fetcher()
        );
        fetchCryptoAssetListMock.mockResolvedValue([
            { symbol: 'BTC', name: 'Bitcoin', circulatingSupply: 19_000_000 },
            { symbol: 'ETH', name: 'Ethereum', circulatingSupply: 120_000_000 },
        ]);

        const map = await getFmpCryptoListMap();

        // circulatingSupply is intentionally excluded from the stored Map value:
        // no production caller reads it (getAssetInfo uses .name, isCryptoSymbol
        // checks presence only), so it is not threaded through the membership record.
        expect(map.get('BTC')).toEqual({ name: 'Bitcoin' });
        expect(map.get('ETH')).toEqual({ name: 'Ethereum' });
    });

    it('normalizes symbols to UPPERCASE keys', async () => {
        getOrSetCacheMock.mockImplementation(
            async (
                _key: string,
                _ttl: number,
                fetcher: () => Promise<unknown>
            ) => fetcher()
        );
        fetchCryptoAssetListMock.mockResolvedValue([
            { symbol: 'btcusd', name: 'Bitcoin USD', circulatingSupply: null },
        ]);

        const map = await getFmpCryptoListMap();
        // Only the name field is stored; UPPERCASE normalization is what matters here
        expect(map.get('BTCUSD')).toEqual({ name: 'Bitcoin USD' });
        expect(map.get('btcusd')).toBeUndefined();
    });

    it('passes correct key and TTL to getOrSetCache', async () => {
        getOrSetCacheMock.mockResolvedValue({});

        await getFmpCryptoListMap();

        expect(getOrSetCacheMock).toHaveBeenCalledWith(
            'crypto:fmp-list',
            86400,
            expect.any(Function)
        );
    });

    it('degrades to empty Map when getOrSetCache throws (infra failure)', async () => {
        getOrSetCacheMock.mockRejectedValue(new Error('Redis down'));
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        const map = await getFmpCryptoListMap();

        expect(map.size).toBe(0);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe('fmpCryptoMembership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the entry for a known symbol (case-insensitive input)', async () => {
        getOrSetCacheMock.mockResolvedValue({
            BTC: { name: 'Bitcoin' },
        });

        const result = await fmpCryptoMembership('btc');
        expect(result).toEqual({ name: 'Bitcoin' });
    });

    it('returns null for an unknown symbol', async () => {
        getOrSetCacheMock.mockResolvedValue({
            BTC: { name: 'Bitcoin' },
        });

        const result = await fmpCryptoMembership('NOTACRYPTO');
        expect(result).toBeNull();
    });

    it('returns null on infra failure (never throws)', async () => {
        getOrSetCacheMock.mockRejectedValue(new Error('Redis down'));
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await expect(fmpCryptoMembership('BTC')).resolves.toBeNull();
        warnSpy.mockRestore();
    });

    it('returns null on FMP failure inside fetcher (never throws)', async () => {
        // Simulate getOrSetCache propagating the fetcher throw (Redis miss + FMP failure)
        getOrSetCacheMock.mockRejectedValue(new Error('FMP 503'));
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await expect(fmpCryptoMembership('BTC')).resolves.toBeNull();
        warnSpy.mockRestore();
    });
});
