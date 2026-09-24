import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketFearGreedCryptoView } from '@/entities/market-fear-greed/model';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

const { mockUnstableCache } = vi.hoisted(() => ({
    mockUnstableCache: vi.fn(
        (
            fn: () => Promise<MarketFearGreedCryptoView>,
            _keys: unknown,
            _opts: unknown
        ) => fn
    ),
}));

vi.mock('next/cache', () => ({
    unstable_cache: mockUnstableCache,
}));

// 통과만 시키는 스파이 — "React.cache로 감쌌다"는 사실 자체를 고정한다
// (근거는 한국판 테스트의 같은 블록 참조).
const { mockReactCache } = vi.hoisted(() => ({
    mockReactCache: vi.fn(<T>(fn: T) => fn),
}));

vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return { ...actual, cache: mockReactCache };
});

vi.mock('@/entities/market-fear-greed/api/marketFearGreedCryptoCache', () => ({
    getCachedMarketFearGreedCrypto: vi.fn(),
    MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT: 'crypto0123456',
}));

import { getMarketFearGreedCryptoStatic } from '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache';
import { getCachedMarketFearGreedCrypto } from '@/entities/market-fear-greed/api/marketFearGreedCryptoCache';

const mockLoader = vi.mocked(getCachedMarketFearGreedCrypto);

const sampleView: MarketFearGreedCryptoView = {
    snapshot: {
        score: 30,
        label: 'FEAR',
        factors: [],
        confidence: 'normal',
        sampleSize: 900,
        asOf: '2026-09-24',
    },
    comparisons: [],
};

describe('getMarketFearGreedCryptoStatic', () => {
    beforeEach(() => {
        mockUnstableCache.mockClear();
        mockLoader.mockClear();
    });

    it('아래층 판독값을 그대로 돌려준다', async () => {
        mockLoader.mockResolvedValue(sampleView);

        expect(await getMarketFearGreedCryptoStatic()).toBe(sampleView);
        expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('React.cache로 감싼다 — 요청 내 metadata와 본문이 같은 답을 본다', () => {
        expect(mockReactCache).toHaveBeenCalledWith(expect.any(Function));
    });

    it('unstable_cache: 1시간, crypto 전용 태그와 fingerprint 키', async () => {
        mockLoader.mockResolvedValue(sampleView);

        await getMarketFearGreedCryptoStatic();

        const call = mockUnstableCache.mock.calls.at(-1);
        expect(call?.[1]).toEqual([
            'market-fear-greed-crypto-static',
            'crypto0123456',
        ]);
        expect(call?.[2]).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:fear-greed:crypto'],
        });
    });

    it('아래층이 던지면 그대로 전파한다', async () => {
        mockLoader.mockRejectedValue(new Error('FMP down'));

        await expect(getMarketFearGreedCryptoStatic()).rejects.toThrow(
            'FMP down'
        );
    });
});
