const { mockIsE2E, sharedProvider, createSpacerSpy, cachedCtorOptions } =
    vi.hoisted(() => ({
        mockIsE2E: vi.fn(() => false),
        sharedProvider: { shared: true },
        createSpacerSpy: vi.fn(),
        cachedCtorOptions: vi.fn(),
    }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    marketDataProviderFor: () => ({
        getBars: vi.fn(),
        getQuote: vi.fn(),
        getTodayBar: vi.fn(),
        getQuoteSnapshot: vi.fn(),
    }),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', async orig => ({
    ...(await orig<
        typeof import('@/shared/api/market/getCachedMarketDataProvider')
    >()),
    getCachedMarketDataProvider: () => sharedProvider,
}));
vi.mock('@/shared/api/market/CachedMarketDataProvider', async orig => {
    const actual =
        await orig<
            typeof import('@/shared/api/market/CachedMarketDataProvider')
        >();
    return {
        ...actual,
        CachedMarketDataProvider: class
            extends actual.CachedMarketDataProvider
        {
            constructor(
                ...args: ConstructorParameters<
                    typeof actual.CachedMarketDataProvider
                >
            ) {
                cachedCtorOptions(args[2]);
                super(...args);
            }
        },
    };
});
vi.mock('@/shared/lib/startSpacer', async orig => {
    const actual = await orig<typeof import('@/shared/lib/startSpacer')>();
    return {
        ...actual,
        createStartSpacer: (ms: number) => {
            createSpacerSpy(ms);
            return actual.createStartSpacer(ms);
        },
    };
});

import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';
import {
    getSignalScanMarketDataProvider,
    SIGNAL_SCAN_HISTORY_MEMORY_ENTRIES,
    SIGNAL_SCAN_PACING_MS,
} from '@/shared/api/market/getSignalScanMarketDataProvider';

describe('getSignalScanMarketDataProvider', () => {
    beforeEach(() => {
        mockIsE2E.mockReturnValue(false);
    });

    it('FMP는 분당 200건(300ms), yahoo는 분당 240건(250ms) 간격이다', () => {
        expect(SIGNAL_SCAN_PACING_MS).toEqual({ us: 300, kr: 250 });
    });

    it('시장마다 캐시 provider를 만들고, 같은 시장은 같은 인스턴스를 돌려준다', () => {
        const us = getSignalScanMarketDataProvider('us');
        const kr = getSignalScanMarketDataProvider('kr');

        expect(us.provider).toBeInstanceOf(CachedMarketDataProvider);
        expect(kr.provider).toBeInstanceOf(CachedMarketDataProvider);
        expect(us).not.toBe(kr);
        expect(getSignalScanMarketDataProvider('us')).toBe(us);
        // 히스토리 L1은 요청 경로(128개)보다 작다 — 기록기가 한 번씩만 훑는 종목으로 힙을 채우지 않게.
        expect(SIGNAL_SCAN_HISTORY_MEMORY_ENTRIES).toBe(16);
        expect(cachedCtorOptions).toHaveBeenCalledTimes(2);
        expect(cachedCtorOptions).toHaveBeenCalledWith(
            expect.objectContaining({ historyMemoryMaxEntries: 16 })
        );
        expect(createSpacerSpy).toHaveBeenCalledWith(SIGNAL_SCAN_PACING_MS.us);
        expect(createSpacerSpy).toHaveBeenCalledWith(SIGNAL_SCAN_PACING_MS.kr);
    });

    it('아직 업스트림을 부르지 않았으면 호출 수는 0이다', () => {
        expect(getSignalScanMarketDataProvider('us').upstreamCalls()).toBe(0);
    });

    it('E2E에서는 공유 provider를 그대로 쓰고 호출 수는 늘 0이다', () => {
        mockIsE2E.mockReturnValue(true);

        const scan = getSignalScanMarketDataProvider('us');

        expect(scan.provider).toBe(sharedProvider);
        expect(scan.upstreamCalls()).toBe(0);
    });
});
