vi.mock('server-only', () => ({}));

const computeMarketFearGreedIndex = vi.fn((..._args: unknown[]) => ({}));
const computeMarketFearGreedHistory = vi.fn((..._args: unknown[]) => []);
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        computeMarketFearGreedIndex: (...args: unknown[]) =>
            computeMarketFearGreedIndex(...args),
        computeMarketFearGreedHistory: (...args: unknown[]) =>
            computeMarketFearGreedHistory(...args),
    };
});

const fetchKrDailyCloses = vi.fn();
vi.mock('../lib/fetchKrDailyCloses', () => ({
    fetchKrDailyCloses: (...args: unknown[]) => fetchKrDailyCloses(...args),
    krLookbackStartDate: (now: Date) => new Date(now.getTime() - 1000),
}));

const getOrSetCache = vi.fn();
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: (...args: unknown[]) => getOrSetCache(...args),
}));

vi.mock('../lib/buildMarketFearGreedComparisons', () => ({
    buildMarketFearGreedComparisons: () => [],
}));

import { MARKET_FEAR_GREED_SERIES_KEYS } from '@y0ngha/siglens-core';
import {
    getCachedMarketFearGreedKr,
    MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT,
} from '../api/marketFearGreedKrCache';
import { MARKET_FEAR_GREED_CONFIG_FINGERPRINT } from '../api/marketFearGreedCache';
import { KOSPI_INDEX_SYMBOL } from '../lib/marketFearGreedKrSymbols';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/** `getOrSetCache(key, ttl, fetcher, guard)`의 fetcher를 실행해 결과를 얻는다. */
async function runFetcher() {
    const call = getOrSetCache.mock.calls.at(-1);
    if (!call) throw new Error('getOrSetCache was not called');
    return (call[2] as () => Promise<unknown>)();
}

const CLOSES = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    close: 100 + i,
}));

describe('getCachedMarketFearGreedKr', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchKrDailyCloses.mockResolvedValue(CLOSES);
        computeMarketFearGreedIndex.mockReturnValue({ score: 50 });
        getOrSetCache.mockResolvedValue({ snapshot: null, comparisons: [] });
    });

    it('scopes its Redis key under kr', async () => {
        await getCachedMarketFearGreedKr();
        expect(getOrSetCache.mock.calls[0][0]).toMatch(
            /^market:fear-greed:kr:/
        );
    });

    it('uses a different config fingerprint than the US index', async () => {
        // 같으면 대체 ETF를 갈아끼워도 옛 판독값이 그대로 서빙된다.
        expect(MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT).not.toBe(
            MARKET_FEAR_GREED_CONFIG_FINGERPRINT
        );
    });

    it('supplies every core series key, deriving vix from the KOSPI index', async () => {
        await getCachedMarketFearGreedKr();
        await runFetcher();

        const input = computeMarketFearGreedIndex.mock.calls[0][0] as Record<
            string,
            unknown[]
        >;
        for (const key of MARKET_FEAR_GREED_SERIES_KEYS) {
            expect(input[key]).toBeDefined();
        }
        expect(fetchKrDailyCloses).toHaveBeenCalledWith(
            KOSPI_INDEX_SYMBOL,
            expect.any(Date),
            expect.any(Date)
        );
        // 파생 시리즈는 창 크기만큼 짧아진다 — 원본을 그대로 넣은 게 아님을 고정한다.
        expect((input.vix as unknown[]).length).toBeLessThan(CLOSES.length);
    });

    it('refuses to cache a reading with no snapshot', async () => {
        await getCachedMarketFearGreedKr();
        const guard = getOrSetCache.mock.calls[0][3] as (v: {
            snapshot: unknown;
        }) => boolean;

        expect(guard({ snapshot: null })).toBe(false);
        expect(guard({ snapshot: { score: 50 } })).toBe(true);
    });

    it('propagates an upstream failure instead of degrading to a partial basket', async () => {
        // 바스켓이 일부만 채워지면 점수의 의미가 조용히 바뀐다.
        // `getOrSetCache`는 fetcher가 던지면 아무것도 쓰지 않는다.
        fetchKrDailyCloses.mockRejectedValue(new Error('yahoo down'));

        await getCachedMarketFearGreedKr();
        await expect(runFetcher()).rejects.toThrow('yahoo down');
    });

    /**
     * 상한이 KRX 세션이 아니면 장중 시세가 종가로 섞여 들어와 하루 종일 값이
     * 흔들리는데 화면에는 "종가 기준"이라고 적힌다. `T23:59:59Z`로 끊던 시절에는
     * yahoo가 KRX 일봉을 09:00 KST에 찍는 덕에 **1초 차이로** 겨우 비켜 갔다.
     */
    it('조회 상한을 KRX 직전 마감일의 KST 하루 끝으로 끊는다', async () => {
        vi.setSystemTime(new Date('2026-08-18T02:00:00Z')); // 화 11:00 KST(장중)
        await getCachedMarketFearGreedKr();
        await runFetcher();

        const [, , to] = fetchKrDailyCloses.mock.calls[0] as [
            string,
            Date,
            Date,
        ];
        const expectedDate = lastClosedSessionDate(
            KR_EQUITY_SESSION,
            new Date('2026-08-18T02:00:00Z')
        );
        expect(to.toISOString()).toBe(`${expectedDate}T15:00:00.000Z`);
        vi.useRealTimers();
    });

    it('TTL은 1시간이다 — EOD 갱신 반영 대기 상한', async () => {
        await getCachedMarketFearGreedKr();

        expect(getOrSetCache.mock.calls[0][1]).toBe(SECONDS_PER_HOUR);
    });
});
