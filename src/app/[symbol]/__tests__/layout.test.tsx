/**
 * SymbolLayoutChrome SSR seed tests — verifies bars seed quantization +
 * stable updatedAt (forming 봉 차단 + ISR HTML 결정성 보장).
 *
 * Pattern: setQueryData(key, quantizedBars, { updatedAt: lastBar.time }).
 * RQ dehydrate는 query state를 spread하므로 dataUpdatedAt이 매 ISR 재생성마다 다르면
 * HTML hash 달라져 ISR write 발생. 마지막 완료 봉의 timestamp로 updatedAt을 고정해
 * 같은 봉 윈도우 안에서는 dehydrated HTML 결정성 보장.
 *
 * - Happy: getQuantizedBarsStatic 성공 → setQueryData에 마지막 봉 time으로 updatedAt
 * - Worst: getQuantizedBarsStatic 실패 → 빈 BarsData sentinel을 updatedAt:0으로 주입 (React 19
 *   SSR 중 getBarsAction 'use server' 호출 방지), assetInfo seed는 정상
 * - fmpSymbol이 없는 assetInfo → bars seed 키가 undefined (assetInfo seed는 그대로 수행)
 * - bars seed에는 prefetchQuery 사용 금지 (회귀 가드 — updatedAt 옵션 없음)
 */

// MISTAKES §17: 모든 vi.mock + 변수 선언은 import 위로(import/first 규칙).
// vi.hoisted로 mock 변수를 호이스트해 vi.mock 콜백에서 참조 가능하게 한다.
const {
    MOCK_EMPTY_INDICATOR_RESULT,
    mockSetQueryData,
    mockPrefetchQuery,
    mockGetAssetInfoResilient,
    mockNotFound,
    mockGetQuantizedBarsStatic,
} = vi.hoisted(() => ({
    MOCK_EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} } as never,
    mockSetQueryData: vi.fn(),
    mockPrefetchQuery: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    // 실제 next/navigation.notFound()와 동일하게 throw해야, 가드 이후 코드가 실행되지
    // 않는다는 것까지 검증된다(단순 스파이면 렌더가 계속 진행돼 가드가 무력해도 통과).
    mockNotFound: vi.fn(() => {
        throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    }),
    mockGetQuantizedBarsStatic: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    notFound: () => mockNotFound(),
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
vi.mock('@/views/symbol/SymbolLayoutHeader', () => ({
    SymbolLayoutHeader: () => null,
}));
vi.mock('@/views/symbol/SymbolTabsSkeleton', () => ({
    SymbolTabsSkeleton: () => null,
}));

// 레이아웃이 `isAdmissibleSymbolShape`(형상 게이트)와 `isUnresolvableDegraded`(→
// VALID_TICKER_RE)를 쓰게 되면서 이 mock에 두 심볼이 필요해졌다. 정규식·판정 로직을
// 손으로 복사하면 프로덕션 규칙이 바뀌어도 테스트는 옛 규칙으로 계속 통과한다
// → 소스에서 가져온다(ticker.ts는 외부 의존이 0이라 importActual이 안전하고,
// market.ts가 선언하는 재수출 관계를 그대로 재현한다).
vi.mock('@/shared/config/market', async () => {
    const actual = await vi.importActual<
        typeof import('@/shared/config/ticker')
    >('@/shared/config/ticker');
    return {
        DEFAULT_TIMEFRAME: '1Day',
        VALID_TICKER_RE: actual.TICKER_RE,
        isAdmissibleSymbolShape: actual.isAdmissibleSymbolShape,
    };
});
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
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
}));

import SymbolLayout, { SymbolLayoutChrome } from '@/app/[symbol]/layout';
import { MS_PER_SECOND } from '@/shared/config/time';

const ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};
const LAST_BAR_TIME = 1717718400; // 2024-06-07T00:00:00Z (epoch seconds)
const LAST_BAR_TIME_MS = LAST_BAR_TIME * MS_PER_SECOND; // RQ dataUpdatedAt은 milliseconds
const QUANTIZED = { bars: [{ time: LAST_BAR_TIME }], indicators: {} };

describe('SymbolLayoutChrome SSR seed (ISR write churn 차단)', () => {
    beforeEach(() => {
        mockSetQueryData.mockClear();
        mockPrefetchQuery.mockClear();
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
        mockGetQuantizedBarsStatic.mockResolvedValue(QUANTIZED);
    });

    it('Happy: quantize된 bars로 setQueryData 호출 + updatedAt은 마지막 봉의 time', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        // 대문자 ticker + marketProfile로 호출한다 — page.tsx와 인자가 같아야
        // 요청 스코프 메모가 접혀 지표가 한 벌만 직렬화된다.
        // (세션 스레딩은 헬퍼 내부 책임 → barsStaticCache.test.ts에서 검증)
        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );

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

    it('Worst: getQuantizedBarsStatic 실패 → 빈 sentinel을 updatedAt:0으로 주입, assetInfo seed는 정상', async () => {
        // React 19: getBarsAction('use server')은 SSR render 중 호출 불가.
        // 빈 BarsData를 query cache에 주입해 useSuspenseQuery가 SSR에서 Server
        // Action을 호출하는 경로를 차단한다 — 클라이언트는 updatedAt:0 → stale
        // 판정 즉시 re-fetch해 실제 bars를 가져온다.
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('FMP down'));

        await expect(
            SymbolLayoutChrome({
                assetInfo: ASSET_INFO,
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

    // 과거엔 "assetInfo가 null이면 seed를 건너뛴다"를 여기서 검증했다. 이제 null assetInfo는
    // 레이아웃 가드가 404로 끊으므로 chrome에 도달할 수 없고, prop 타입도 non-null이다.
    // 그 시나리오의 회귀 가드는 파일 하단 `SymbolLayout 404 가드` describe에 있다.
    it('fmpSymbol이 없는 assetInfo도 bars seed 키를 undefined로 구성한다', async () => {
        const NO_FMP_SYMBOL = { symbol: 'AAPL', name: 'Apple Inc.' };

        await SymbolLayoutChrome({
            assetInfo: NO_FMP_SYMBOL,
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
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
        mockGetQuantizedBarsStatic.mockResolvedValue({
            bars: [],
            indicators: {},
        });

        await expect(
            SymbolLayoutChrome({
                assetInfo: ASSET_INFO,
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

    // 세션 spec 매핑(crypto → always-open, equity → scheduled)은 이제
    // `getQuantizedBarsStatic` 내부 책임이라 barsStaticCache.test.ts가 검증한다.
    // 여기서는 레이아웃이 올바른 marketProfile을 헬퍼에 넘기는지만 본다.
    it('CRYPTO assetInfo → 헬퍼에 marketProfile "crypto"를 넘긴다', async () => {
        const CRYPTO_ASSET_INFO = {
            symbol: 'BTCUSD',
            name: 'Bitcoin USD',
            fmpSymbol: 'BTCUSD',
            marketProfile: 'crypto' as const,
        };

        await SymbolLayoutChrome({
            assetInfo: CRYPTO_ASSET_INFO,
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'BTCUSD',
            '1Day',
            'crypto',
            'BTCUSD'
        );
    });

    it('EQUITY assetInfo (marketProfile 없음) → 헬퍼에 "us-equity"를 넘긴다', async () => {
        const EQUITY_ASSET_INFO = {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            fmpSymbol: 'AAPL',
            // marketProfile intentionally absent (legacy equity)
        };

        await SymbolLayoutChrome({
            assetInfo: EQUITY_ASSET_INFO,
            params: Promise.resolve({ symbol: 'AAPL' }),
        });

        expect(mockGetQuantizedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );
    });
});

/**
 * SymbolLayout 404 가드 — 이 PR의 핵심 동작이다.
 *
 * Next 16.2에서 `notFound()`가 Suspense 경계 **안쪽**에서 던져지면 HTTP 상태가 200으로
 * 남는다(soft 404). 이 라우트 트리는 `loading.tsx`와 레이아웃 Suspense를 쓰므로 판정이
 * 반드시 레이아웃 최상단에 있어야 한다 — 자식 page.tsx로 되돌리면 9개 탭 전부가 다시
 * 200이 된다.
 *
 * ⚠️ 유닛 테스트가 고정할 수 있는 건 "`notFound()`가 불렸는가"까지다. 프레임워크가
 * 실제로 어떤 상태 코드를 내보내는지는 프로덕션 빌드에서만 관측 가능하므로
 * `e2e/specs/not-found.spec.ts`가 상태 코드를 단언한다. 두 층이 짝을 이룬다.
 */
describe('SymbolLayout 404 가드 (Suspense 경계보다 위)', () => {
    beforeEach(() => {
        mockNotFound.mockClear();
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
    });

    const render = (symbol: string) =>
        SymbolLayout({
            children: null,
            params: Promise.resolve({ symbol }),
        });

    it.each(['HVO.L', 'SHOP.TO', 'XYZ.V', 'ABC.CN', '7203.T'])(
        "해외 거래소 접미사 '%s'는 자산 조회 없이 notFound()로 끊는다",
        async symbol => {
            await expect(render(symbol)).rejects.toThrow(
                'NEXT_HTTP_ERROR_FALLBACK;404'
            );
            // FMP 호출 전에 끊는 것이 이 게이트의 존재 이유다 — 조회가 일어나면 실패.
            expect(mockGetAssetInfoResilient).not.toHaveBeenCalled();
        }
    );

    it('형상이 아예 맞지 않는 입력도 조회 없이 notFound()', async () => {
        await expect(render('definitely-not-a-real-page')).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404'
        );
        expect(mockGetAssetInfoResilient).not.toHaveBeenCalled();
    });

    it('미국 클래스 구분자(BRK.B)는 형상 게이트를 통과해 조회까지 간다', async () => {
        await render('BRK.B');
        expect(mockGetAssetInfoResilient).toHaveBeenCalledWith('BRK.B');
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('degraded가 아닌데 assetInfo가 null이면 notFound()', async () => {
        // 캐시·crypto_assets·DB·FMP를 다 거쳐도 정체 불명 → 실재하지 않는 심볼.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        });
        await expect(render('ZZZZNOPE')).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404'
        );
        expect(mockGetAssetInfoResilient).toHaveBeenCalledWith('ZZZZNOPE');
    });

    it('degraded + 미국 형상 불합격(크립토 형상)이면 notFound()', async () => {
        // isUnresolvableDegraded 경로 — FMP와 crypto_assets가 동시에 죽은 상황.
        //
        // ⚠️ assetInfo를 null로 두면 안 된다. `getAssetInfoResilient`는 degrade 시
        // **항상 non-null 폴백**(`{ symbol, name }`)을 돌려주므로 `{null, true}`는 실제로
        // 존재하지 않는 상태이고, 그렇게 mock하면 `!assetInfo` 항만으로 통과해
        // `isUnresolvableDegraded(...) ||`를 지워도 테스트가 green으로 남는다.
        // 프로덕션과 같은 모양으로 mock해야 이 항이 실제로 검증된다.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: '1000SATSUSD', name: '1000SATSUSD' },
            degraded: true,
        });
        await expect(render('1000SATSUSD')).rejects.toThrow(
            'NEXT_HTTP_ERROR_FALLBACK;404'
        );
    });

    it('degraded여도 assetInfo가 해결되면 404가 아니다', async () => {
        // FMP 전면 장애 중에도 DB가 살아 있으면 실재 종목은 살아남아야 한다
        // (기존 degrade 200 + noindex 동작 보존). 여기가 깨지면 장애 시 색인된
        // 페이지가 대량 404가 된다.
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'AAPL' },
            degraded: true,
        });
        await expect(render('AAPL')).resolves.toBeDefined();
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('정상 심볼은 404 없이 렌더된다', async () => {
        await expect(render('AAPL')).resolves.toBeDefined();
        expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('소문자 경로도 대문자로 정규화해 조회한다', async () => {
        await render('aapl');
        expect(mockGetAssetInfoResilient).toHaveBeenCalledWith('AAPL');
    });
});
