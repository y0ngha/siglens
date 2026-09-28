vi.mock('server-only', () => ({}));

const computeCryptoFearGreedIndex = vi.fn(
    (..._args: unknown[]): unknown => ({})
);
const computeCryptoFearGreedHistory = vi.fn(
    (..._args: unknown[]): unknown[] => []
);
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        computeCryptoFearGreedIndex: (...args: unknown[]) =>
            computeCryptoFearGreedIndex(...args),
        computeCryptoFearGreedHistory: (...args: unknown[]) =>
            computeCryptoFearGreedHistory(...args),
    };
});

const fetchCryptoDailyBars = vi.fn();
vi.mock('../lib/fetchCryptoDailyBars', async () => {
    const actual = await vi.importActual<
        typeof import('../lib/fetchCryptoDailyBars')
    >('../lib/fetchCryptoDailyBars');
    return {
        ...actual,
        fetchCryptoDailyBars: (...args: unknown[]) =>
            fetchCryptoDailyBars(...args),
    };
});

const getOrSetCache = vi.fn();
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: (...args: unknown[]) => getOrSetCache(...args),
}));

import {
    getCachedMarketFearGreedCrypto,
    MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT,
} from '../api/marketFearGreedCryptoCache';
import { MARKET_FEAR_GREED_CONFIG_FINGERPRINT } from '../api/marketFearGreedCache';
import { MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT } from '../api/marketFearGreedKrCache';
import {
    MARKET_FEAR_GREED_CRYPTO_BENCHMARK,
    MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN,
    MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
} from '../lib/marketFearGreedCryptoSymbols';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/** `getOrSetCache(key, ttl, fetcher, guard)`의 fetcher를 실행해 결과를 얻는다. */
async function runFetcher() {
    const call = getOrSetCache.mock.calls.at(-1);
    if (!call) throw new Error('getOrSetCache was not called');
    return (call[2] as () => Promise<unknown>)();
}

function lastGetOrSetCall(): unknown[] {
    const call = getOrSetCache.mock.calls.at(-1);
    if (!call) throw new Error('getOrSetCache was not called');
    return call;
}

const BARS = [{ date: '2026-09-24', close: 1, volume: 2 }];

describe('getCachedMarketFearGreedCrypto', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchCryptoDailyBars.mockResolvedValue(BARS);
        computeCryptoFearGreedIndex.mockReturnValue({ score: 50 });
        getOrSetCache.mockResolvedValue({ snapshot: null, comparisons: [] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('Redis 키를 crypto 아래에 둔다', async () => {
        await getCachedMarketFearGreedCrypto();
        expect(lastGetOrSetCall()[0]).toMatch(/^market:fear-greed:crypto:/);
    });

    it('미국·한국과 다른 config fingerprint를 쓴다', () => {
        expect(MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT).not.toBe(
            MARKET_FEAR_GREED_CONFIG_FINGERPRINT
        );
        expect(MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT).not.toBe(
            MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT
        );
    });

    it('TTL은 1시간 고정이다', async () => {
        await getCachedMarketFearGreedCrypto();
        expect(lastGetOrSetCall()[1]).toBe(SECONDS_PER_HOUR);
    });

    it('BTC·금·유니버스 19개를 어제(UTC)까지 받아 core에 넘긴다', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-25T00:30:00Z'));
        await getCachedMarketFearGreedCrypto();
        await runFetcher();

        const symbols = fetchCryptoDailyBars.mock.calls.map(c => c[0]);
        expect(symbols).toHaveLength(21);
        expect(symbols).toContain(MARKET_FEAR_GREED_CRYPTO_BENCHMARK);
        expect(symbols).toContain(MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN);
        for (const call of fetchCryptoDailyBars.mock.calls) {
            expect(call[2]).toBe('2026-09-24');
        }

        const input = computeCryptoFearGreedIndex.mock.calls.at(-1)?.[0] as {
            benchmark: unknown[];
            safeHaven: unknown[];
            universe: Record<string, unknown[]>;
        };
        expect(input.benchmark).toEqual(BARS);
        // 금은 종가만 넘긴다 — 거래량은 쓰지 않는다.
        expect(input.safeHaven).toEqual([{ date: '2026-09-24', close: 1 }]);
        expect(Object.keys(input.universe)).toEqual([
            ...MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
        ]);
    });

    it('비교는 달력일 기준으로 고른다(7일·30일·365일 전)', async () => {
        const day = (offset: number) =>
            new Date(Date.UTC(2025, 0, 1) + offset * 86_400_000)
                .toISOString()
                .slice(0, 10);
        // 1주 안쪽에서 하루(495)가 inner join으로 빠진 히스토리. 인덱스로 세면 "1주 전"이
        // 491로 밀린다 — 달력일로 세야 492가 나온다.
        const history = Array.from({ length: 500 }, (_, i) => i)
            .filter(i => i !== 495)
            .map(i => ({ date: day(i), score: i % 100, label: 'NEUTRAL' }));
        computeCryptoFearGreedHistory.mockReturnValue(history);

        await getCachedMarketFearGreedCrypto();
        const view = (await runFetcher()) as {
            comparisons: { key: string; date: string }[];
        };

        expect(view.comparisons.map(c => [c.key, c.date])).toEqual([
            ['now', day(499)],
            ['1w', day(492)],
            ['1m', day(469)],
            ['1y', day(134)],
        ]);
    });

    it('core가 null이면 snapshot: null 뷰를 만들고, 그 뷰는 캐시하지 않는다', async () => {
        computeCryptoFearGreedIndex.mockReturnValue(null);

        await getCachedMarketFearGreedCrypto();
        const view = (await runFetcher()) as { snapshot: unknown };
        expect(view.snapshot).toBeNull();

        const guard = lastGetOrSetCall()[3] as (v: {
            snapshot: unknown;
        }) => boolean;
        expect(guard({ snapshot: null })).toBe(false);
        expect(guard({ snapshot: { score: 50 } })).toBe(true);
    });

    it('한 심볼이라도 실패하면 부분 바스켓으로 degrade하지 않고 던진다', async () => {
        fetchCryptoDailyBars.mockImplementation(async (symbol: string) => {
            if (symbol === 'SOLUSD') throw new Error('FMP down');
            return BARS;
        });

        await getCachedMarketFearGreedCrypto();
        await expect(runFetcher()).rejects.toThrow('FMP down');
    });
});
