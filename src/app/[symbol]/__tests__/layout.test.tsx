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
 * - Worst: getBarsStatic 실패 → 빈 BarsData sentinel을 updatedAt:0으로 주입 (React 19
 *   SSR 중 getBarsAction 'use server' 호출 방지), assetInfo seed는 정상
 * - degraded asset(null) → assetInfo seed skip, bars는 fmpSymbol undefined로 시도
 * - bars seed에는 prefetchQuery 사용 금지 (회귀 가드 — updatedAt 옵션 없음)
 */

// MISTAKES §17: 모든 vi.mock + 변수 선언은 import 위로(import/first 규칙).
// vi.hoisted로 mock 변수를 호이스트해 vi.mock 콜백에서 참조 가능하게 한다.
const {
    MOCK_EMPTY_INDICATOR_RESULT,
    mockSetQueryData,
    mockPrefetchQuery,
    mockGetAssetInfoResilient,
    mockGetBarsStatic,
    mockQuantize,
} = vi.hoisted(() => ({
    MOCK_EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} } as never,
    mockSetQueryData: vi.fn(),
    mockPrefetchQuery: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetBarsStatic: vi.fn(),
    mockQuantize: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    EMPTY_INDICATOR_RESULT: MOCK_EMPTY_INDICATOR_RESULT,
    // Phase 1 added sessionSpecFor(marketProfileOf(assetInfo)) which imports
    // US_EQUITY_SESSION and CRYPTO_SESSION from siglens-core. Provide minimal
    // valid MarketSessionSpec objects so the switch in sessionSpecFor resolves
    // without throwing "No export defined on mock".
    US_EQUITY_SESSION: {
        kind: 'scheduled' as const,
        timeZone: 'America/New_York',
        openMinute: 570,
        closeMinute: 960,
        weekendDays: [0, 6],
    },
    CRYPTO_SESSION: { kind: 'always-open' as const },
}));

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    HydrationBoundary: () => null,
    QueryClient: function MockQueryClientClass() {
        return {
            setQueryData: mockSetQueryData,
            prefetchQuery: mockPrefetchQuery,
        };
    },
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

vi.mock('@/entities/ticker', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars', () => ({
    getBarsStatic: (symbol: string, timeframe: string, fmpSymbol?: string) =>
        mockGetBarsStatic(symbol, timeframe, fmpSymbol),
    // Phase 1 extended the call to pass a session spec as the third argument.
    // Capture all 3 args so tests can assert the correct session is threaded.
    quantizeBarsDataToLastClosed: (
        data: unknown,
        now: Date,
        session?: unknown
    ) => mockQuantize(data, now, session),
}));

import { SymbolLayoutChrome } from '@/app/[symbol]/layout';
import { MS_PER_SECOND } from '@/shared/config/time';

const ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};
const LAST_BAR_TIME = 1717718400; // 2024-06-07T00:00:00Z (epoch seconds)
const LAST_BAR_TIME_MS = LAST_BAR_TIME * MS_PER_SECOND; // RQ dataUpdatedAt은 milliseconds
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
        // ASSET_INFO has no marketProfile → defaults to us-equity → US_EQUITY_SESSION
        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date), {
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });

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

    it('Worst: getBarsStatic 실패 → 빈 sentinel을 updatedAt:0으로 주입, assetInfo seed는 정상', async () => {
        // React 19: getBarsAction('use server')은 SSR render 중 호출 불가.
        // 빈 BarsData를 query cache에 주입해 useSuspenseQuery가 SSR에서 Server
        // Action을 호출하는 경로를 차단한다 — 클라이언트는 updatedAt:0 → stale
        // 판정 즉시 re-fetch해 실제 bars를 가져온다.
        mockGetBarsStatic.mockRejectedValue(new Error('FMP down'));

        await expect(
            SymbolLayoutChrome({
                params: Promise.resolve({ symbol: 'AAPL' }),
            })
        ).resolves.toBeDefined();

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toHaveLength(1);
        const [key, data, options] = barsSeedCalls[0];
        expect(key).toEqual(['bars', 'AAPL', '1Day', 'AAPL']);
        // 빈 sentinel: bars 없음, EMPTY_INDICATOR_RESULT
        expect(data).toEqual({
            bars: [],
            indicators: MOCK_EMPTY_INDICATOR_RESULT,
        });
        // updatedAt:0 — 결정적 dehydrated HTML + 클라이언트 즉시 stale 판정
        expect(options).toEqual({ updatedAt: 0 });

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

    it('CRYPTO assetInfo → quantizeBarsDataToLastClosed called with CRYPTO_SESSION (always-open)', async () => {
        // A crypto AssetInfo carries marketProfile: 'crypto' → sessionSpecFor maps
        // 'always-open' sessionModel → CRYPTO_SESSION { kind: 'always-open' }.
        const CRYPTO_ASSET_INFO = {
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            fmpSymbol: 'BTCUSD',
            marketProfile: 'crypto' as const,
        };
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: CRYPTO_ASSET_INFO,
            degraded: false,
        });
        mockGetBarsStatic.mockResolvedValue(RAW_BARS);

        await SymbolLayoutChrome({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        // Core fix: crypto must strip the forming bar with CRYPTO_SESSION, not
        // US_EQUITY_SESSION, to prevent ISR write-churn on the shared bars key.
        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date), {
            kind: 'always-open',
        });
    });

    it('EQUITY assetInfo (no marketProfile) → quantizeBarsDataToLastClosed called with US_EQUITY_SESSION', async () => {
        // An equity AssetInfo has no marketProfile (undefined) → defaults to
        // 'us-equity' → sessionSpecFor maps 'us-equity-et' → US_EQUITY_SESSION.
        const EQUITY_ASSET_INFO = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            fmpSymbol: 'AAPL',
            // marketProfile intentionally absent (legacy equity)
        };
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });
        mockGetBarsStatic.mockResolvedValue(RAW_BARS);

        await SymbolLayoutChrome({
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockQuantize).toHaveBeenCalledWith(RAW_BARS, expect.any(Date), {
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });
    });
});
