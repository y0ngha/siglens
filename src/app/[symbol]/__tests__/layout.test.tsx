/**
 * SymbolLayoutChrome SSR seed tests — verifies bars seed quantization +
 * stable updatedAt (forming 봉 차단 + ISR HTML 결정성 보장).
 *
 * Pattern: setQueryData(key, quantizedBars, { updatedAt: lastBar.time }).
 * RQ dehydrate는 query state를 spread하므로 dataUpdatedAt이 매 ISR 재생성마다 다르면
 * HTML hash 달라져 ISR write 발생. 마지막 완료 봉의 timestamp로 updatedAt을 고정해
 * 같은 봉 윈도우 안에서는 dehydrated HTML 결정성 보장.
 *
 * - Happy: getBarsStatic 성공 → quantize → setQueryData에 마지막 봉 time으로 updatedAt
 * - Worst: getBarsStatic 실패 → bars seed 미주입, layout는 throw 없음, assetInfo seed는 정상
 * - degraded asset(null) → assetInfo seed skip, bars는 fmpSymbol undefined로 시도
 * - bars seed에는 prefetchQuery 사용 금지 (회귀 가드 — updatedAt 옵션 없음)
 */

const mockSetQueryData = vi.fn();
const mockPrefetchQuery = vi.fn();

function MockQueryClientClass() {
    return {
        setQueryData: mockSetQueryData,
        prefetchQuery: mockPrefetchQuery,
    };
}

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    HydrationBoundary: () => null,
    QueryClient: MockQueryClientClass,
}));

vi.mock('@/app/[symbol]/SymbolLayoutClient', () => ({
    SymbolLayoutFloatingChat: () => null,
    SymbolLayoutJail: () => null,
    SymbolLayoutProviders: () => null,
}));
vi.mock('@/widgets/symbol-page/SymbolLayoutHeader', () => ({
    SymbolLayoutHeader: () => null,
}));
vi.mock('@/widgets/symbol-page/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => null,
}));

vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
}));
vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: {
        assetInfo: (symbol: string) => ['assetInfo', symbol],
        bars: (symbol: string, timeframe: string, fmpSymbol?: string) => [
            'bars',
            symbol,
            timeframe,
            fmpSymbol,
        ],
    },
    QUERY_STALE_TIME_MS: 60_000,
}));

const mockGetAssetInfoResilient = vi.fn();
vi.mock('@/entities/ticker', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

const mockGetBarsStatic = vi.fn();
const mockQuantize = vi.fn();
vi.mock('@/entities/bars', () => ({
    getBarsStatic: (symbol: string, timeframe: string, fmpSymbol?: string) =>
        mockGetBarsStatic(symbol, timeframe, fmpSymbol),
    quantizeBarsDataToLastClosed: (data: unknown, now: Date) =>
        mockQuantize(data, now),
}));

import { SymbolLayoutChrome } from '@/app/[symbol]/layout';

const ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};
const LAST_BAR_TIME = 1717718400; // 2024-06-07T00:00:00Z (epoch seconds)
const LAST_BAR_TIME_MS = LAST_BAR_TIME * 1000; // RQ dataUpdatedAt은 milliseconds
const RAW_BARS = {
    bars: [{ time: 1717632000 }, { time: 1717718400 }],
    indicators: {},
};
const QUANTIZED = { bars: [{ time: LAST_BAR_TIME }], indicators: {} };

describe('SymbolLayoutChrome SSR seed (ISR write churn 차단)', () => {
    beforeEach(() => {
        mockSetQueryData.mockClear();
        mockPrefetchQuery.mockClear();
        mockGetAssetInfoResilient.mockReset();
        mockGetBarsStatic.mockReset();
        mockQuantize.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
        mockGetBarsStatic.mockResolvedValue(RAW_BARS);
        mockQuantize.mockReturnValue(QUANTIZED);
    });

    it('Happy: quantize된 bars로 setQueryData 호출 + updatedAt은 마지막 봉의 time', async () => {
        await SymbolLayoutChrome({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(mockGetBarsStatic).toHaveBeenCalledWith('aapl', '1Day', 'AAPL');
        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date));

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toHaveLength(1);
        const [key, data, options] = barsSeedCalls[0];
        expect(key).toEqual(['bars', 'aapl', '1Day', 'AAPL']);
        expect(data).toBe(QUANTIZED);
        // 회귀 가드: updatedAt 명시 — 마지막 봉의 time으로 고정해야 ISR HTML 결정성 보장
        expect(options).toEqual({ updatedAt: LAST_BAR_TIME_MS });

        // 회귀 가드: prefetchQuery는 사용 금지 (updatedAt 옵션 없음)
        expect(mockPrefetchQuery).not.toHaveBeenCalled();
    });

    it('Worst: getBarsStatic 실패 → bars seed 미주입, assetInfo seed는 정상', async () => {
        mockGetBarsStatic.mockRejectedValue(new Error('FMP down'));

        await expect(
            SymbolLayoutChrome({
                params: Promise.resolve({ symbol: 'AAPL' }),
            })
        ).resolves.toBeDefined();

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toHaveLength(0);
        // assetInfo seed는 그대로 박혀야 한다 (bars 실패가 assetInfo seed 막지 않음)
        const assetInfoCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'assetInfo'
        );
        expect(assetInfoCalls).toHaveLength(1);
    });

    it('assetInfo가 degraded(null)면 assetInfo seed skip, bars는 fmpSymbol undefined로 시도', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: true,
        });

        await SymbolLayoutChrome({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        const assetInfoCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'assetInfo'
        );
        expect(assetInfoCalls).toHaveLength(0);
        expect(mockGetBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined
        );
        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toHaveLength(1);
        expect(barsSeedCalls[0][0]).toEqual([
            'bars',
            'AAPL',
            '1Day',
            undefined,
        ]);
        expect(barsSeedCalls[0][2]).toEqual({ updatedAt: LAST_BAR_TIME_MS });
    });

    it('quantize 결과 bars가 비어 있어도 throw 없음, updatedAt 0으로 fallback', async () => {
        mockQuantize.mockReturnValue({ bars: [], indicators: {} });

        await expect(
            SymbolLayoutChrome({
                params: Promise.resolve({ symbol: 'AAPL' }),
            })
        ).resolves.toBeDefined();

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toHaveLength(1);
        // updatedAt 0 fallback — bar 없으면 안정성 보장 안 되지만 throw 없이 진행
        expect(barsSeedCalls[0][2]).toEqual({ updatedAt: 0 });
    });
});
