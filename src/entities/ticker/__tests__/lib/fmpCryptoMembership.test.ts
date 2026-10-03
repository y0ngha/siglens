// vi.mock calls are hoisted above all imports; declared first so they are in scope
// when vitest hoists them to the top of the compiled module.

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
    SECONDS_PER_HOUR: 3600,
    SECONDS_PER_YEAR: 31536000,
    MS_PER_HOUR: 3600000,
}));
vi.mock('../../api', () => ({
    fetchCryptoAssetList: fetchCryptoAssetListMock,
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getFmpCryptoListMap,
    fmpCryptoMembership,
    FMP_CRYPTO_LIST_MEMORY_TTL_MS,
    _resetFmpCryptoListMemoForTest,
} from '../../lib/fmpCryptoMembership';
import { CRYPTO_FMP_LIST_CACHE_KEY } from '../../lib/cacheKeys';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('getFmpCryptoListMap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetFmpCryptoListMemoForTest();
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
            CRYPTO_FMP_LIST_CACHE_KEY,
            SECONDS_PER_DAY,
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
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[fmpCryptoMembership] getFmpCryptoListMap failed, degrading to empty'
            ),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });
});

describe('fmpCryptoMembership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetFmpCryptoListMemoForTest();
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
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[fmpCryptoMembership] getFmpCryptoListMap failed, degrading to empty'
            ),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('returns null on FMP failure inside fetcher (never throws)', async () => {
        // Simulate getOrSetCache propagating the fetcher throw (Redis miss + FMP failure)
        getOrSetCacheMock.mockRejectedValue(new Error('FMP 503'));
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await expect(fmpCryptoMembership('BTC')).resolves.toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[fmpCryptoMembership] getFmpCryptoListMap failed, degrading to empty'
            ),
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });
});

describe('getFmpCryptoListMap의 인스턴스 메모리(L1) 캐시는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetFmpCryptoListMemoForTest();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('TTL 안의 반복 호출은 Redis(L2)를 다시 읽지 않는다', async () => {
        getOrSetCacheMock.mockResolvedValue({ BTC: { name: 'Bitcoin' } });

        await fmpCryptoMembership('AAPL');
        await fmpCryptoMembership('MSFT');
        const btc = await fmpCryptoMembership('btc');

        expect(btc).toEqual({ name: 'Bitcoin' });
        expect(getOrSetCacheMock).toHaveBeenCalledTimes(1);
    });

    it('TTL이 지나면 L2를 다시 읽어 새 목록을 반영한다', async () => {
        vi.useFakeTimers();
        getOrSetCacheMock.mockResolvedValueOnce({ BTC: { name: 'Bitcoin' } });
        getOrSetCacheMock.mockResolvedValueOnce({
            BTC: { name: 'Bitcoin' },
            NEWCOIN: { name: 'New Coin' },
        });

        expect(await fmpCryptoMembership('NEWCOIN')).toBeNull();
        vi.advanceTimersByTime(FMP_CRYPTO_LIST_MEMORY_TTL_MS + 1);

        expect(await fmpCryptoMembership('NEWCOIN')).toEqual({
            name: 'New Coin',
        });
        expect(getOrSetCacheMock).toHaveBeenCalledTimes(2);
    });

    it('동시 L1 miss는 L2 조회 한 번으로 접는다', async () => {
        let release!: (value: unknown) => void;
        getOrSetCacheMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    release = resolve;
                })
        );

        const calls = [
            fmpCryptoMembership('BTC'),
            fmpCryptoMembership('ETH'),
            fmpCryptoMembership('AAPL'),
        ];
        await new Promise(resolve => setTimeout(resolve, 0));
        release({ BTC: { name: 'Bitcoin' }, ETH: { name: 'Ethereum' } });

        expect(await Promise.all(calls)).toEqual([
            { name: 'Bitcoin' },
            { name: 'Ethereum' },
            null,
        ]);
        expect(getOrSetCacheMock).toHaveBeenCalledTimes(1);
    });

    it('실패(빈 Map 폴백)는 L1에 남기지 않아 다음 호출이 다시 시도한다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        getOrSetCacheMock.mockRejectedValueOnce(new Error('Redis down'));
        getOrSetCacheMock.mockResolvedValueOnce({ BTC: { name: 'Bitcoin' } });

        expect(await fmpCryptoMembership('BTC')).toBeNull();
        expect(await fmpCryptoMembership('BTC')).toEqual({ name: 'Bitcoin' });
        expect(getOrSetCacheMock).toHaveBeenCalledTimes(2);
    });

    it('만료 후 갱신이 실패하면 만료된 직전 목록을 돌려주고, 다음 호출은 다시 갱신을 시도한다', async () => {
        vi.useFakeTimers();
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        getOrSetCacheMock.mockResolvedValueOnce({ BTC: { name: 'Bitcoin' } });
        getOrSetCacheMock.mockRejectedValueOnce(new Error('Redis down'));
        getOrSetCacheMock.mockResolvedValueOnce({
            BTC: { name: 'Bitcoin' },
            NEWCOIN: { name: 'New Coin' },
        });

        await fmpCryptoMembership('BTC');
        vi.advanceTimersByTime(FMP_CRYPTO_LIST_MEMORY_TTL_MS + 1);

        expect(await fmpCryptoMembership('BTC')).toEqual({ name: 'Bitcoin' });
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('serving expired list'),
            expect.any(Error)
        );
        expect(await fmpCryptoMembership('NEWCOIN')).toEqual({
            name: 'New Coin',
        });
        expect(getOrSetCacheMock).toHaveBeenCalledTimes(3);
    });
});
