/**
 * SymbolLayoutChrome 테스트 — **봉을 seed하지 않는다**는 계약과, 헤더에 서버 계산
 * 공포·탐욕 스냅샷을 내려보낸다는 계약을 고정한다.
 *
 * 예전엔 이 레이아웃이 일봉 500개 + buySellVolume을 모든 탭에 seed했고(2026-08-24
 * 프로덕션 실측 raw 76KB, `/[symbol]/position`에서 RSC 페이로드의 47%), 이 파일도
 * 그 seed의 `updatedAt` 결정성을 검증했다. 그 seed가 필요한 소비자는 헤더 칩
 * 하나뿐이었고(차트·공포탐욕 탭은 각자 page.tsx에서 직접 seed한다), 칩이 서버
 * 스냅샷을 받게 되면서 통째로 사라졌다.
 *
 * 그래서 지금 이 파일이 지키는 것은 정반대다:
 * - bars seed 부재 (되살아나면 7개 탭에 76KB가 다시 실린다)
 * - assetInfo seed는 유지 (updatedAt 0으로 ISR HTML 결정성)
 * - 헤더에 전달되는 `fearGreedSnapshot` (이 PR의 핵심 — 사용자와 JS 미실행
 *   크롤러가 보는 값이다)
 * - 봉 조회 인자가 page.tsx와 동일 (React.cache 메모가 접히는 조건)
 * - 조회 실패 시 throw 없이 스냅샷만 null
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
    mockGetSeedBarsStatic,
    mockComputeFearGreedIndex,
} = vi.hoisted(() => ({
    MOCK_EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} } as never,
    mockSetQueryData: vi.fn(),
    mockComputeFearGreedIndex: vi.fn(() => ({
        score: 42,
        label: 'NEUTRAL' as const,
        confidence: 'full' as const,
    })),
    mockPrefetchQuery: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    // 실제 next/navigation.notFound()와 동일하게 throw해야, 가드 이후 코드가 실행되지
    // 않는다는 것까지 검증된다(단순 스파이면 렌더가 계속 진행돼 가드가 무력해도 통과).
    mockNotFound: vi.fn(() => {
        throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    }),
    mockGetQuantizedBarsStatic: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
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
    // 칩 값을 서버에서 확정하는 순수 함수. 이 파일의 관심사는 seed 부재와 조회
    // 인자이지 지수 계산이 아니므로 결정적 스텁으로 고정한다.
    computeFearGreedIndex: mockComputeFearGreedIndex,
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

// layout은 seed만 하므로 축소판(getSeedBarsStatic)을 쓴다. 이 mock이 원본
// (getQuantizedBarsStatic)을 가리키면 축소 여부를 검증할 수 없으니 분리해 둔다.
vi.mock('@/entities/bars', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: mockGetSeedBarsStatic,
}));

import SymbolLayout, { SymbolLayoutChrome } from '@/app/[symbol]/layout';
import { SymbolLayoutJail } from '@/app/[symbol]/SymbolLayoutClient';
import { RelatedSymbols } from '@/views/symbol/RelatedSymbols';

const ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};
const LAST_BAR_TIME = 1717718400; // 2024-06-07T00:00:00Z (epoch seconds)
const QUANTIZED = {
    bars: [{ time: LAST_BAR_TIME }],
    indicators: { buySellVolume: [{ buy: 10, sell: 5 }] },
};

/**
 * `SymbolLayoutChrome`은 RSC라 element 트리만 돌려준다(렌더되지 않는다) — 그래서
 * 렌더 시점 스파이로는 prop을 볼 수 없고, 반환된 JSX에서 직접 꺼내야 한다.
 * 구조는 `<HydrationBoundary><SymbolLayoutHeader …/></HydrationBoundary>`.
 */
function headerPropsOf(tree: unknown): Record<string, unknown> {
    const boundary = tree as { props?: { children?: { props?: unknown } } };
    return (boundary.props?.children?.props ?? {}) as Record<string, unknown>;
}

describe('SymbolLayoutChrome — 봉 seed 없이 공포·탐욕 스냅샷만 내린다', () => {
    beforeEach(() => {
        mockSetQueryData.mockClear();
        mockPrefetchQuery.mockClear();
        mockComputeFearGreedIndex.mockClear();
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
        mockGetSeedBarsStatic.mockResolvedValue(QUANTIZED);
    });

    /**
     * **이 스위트의 존재 이유.** 예전엔 이 레이아웃이 일봉 500개 + buySellVolume을
     * 모든 탭에 seed했다 — 2026-08-24 프로덕션 실측 raw 76KB, `/[symbol]/position`
     * 에서는 RSC 페이로드의 47%. 그런데 그 seed가 필요한 소비자는 헤더의 공포·탐욕
     * 칩 하나뿐이었고(차트·공포탐욕 탭은 각자 page.tsx에서 직접 seed한다), 칩이
     * 서버 계산 스냅샷을 받으면 통째로 불필요해진다.
     *
     * seed가 되살아나면 그 76KB가 7개 탭에 다시 실린다 — 그걸 막는 가드다.
     */
    it('bars를 seed하지 않는다 (7탭 × 76KB 회귀 가드)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toEqual([]);
        // 회귀 가드: prefetchQuery도 금지 (updatedAt 옵션이 없어 ISR write churn 유발)
        expect(mockPrefetchQuery).not.toHaveBeenCalled();
    });

    /**
     * **이 PR의 핵심 계약.** 봉 seed를 없앨 수 있었던 유일한 이유가 "칩 값을
     * 서버가 확정해 prop으로 내려보낸다"이므로, 그게 실제로 일어나는지 단언한다.
     *
     * 이 단언이 없으면 `const fearGreedSnapshot = null`로 바꿔도 전부 초록이다 —
     * 사용자와 JS 미실행 크롤러가 보는 값이 통째로 사라지는데도(리뷰 round 1이
     * 변이로 확인).
     */
    it('서버가 계산한 공포·탐욕 스냅샷을 헤더에 넘긴다', async () => {
        const tree = await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(headerPropsOf(tree)).toEqual(
            expect.objectContaining({
                fearGreedSnapshot: {
                    score: 42,
                    label: 'NEUTRAL',
                    confidence: 'full',
                },
            })
        );
    });

    /**
     * 인자 순서 회귀 가드 — `computeFearGreedIndex(bars, buySellVolume)`이다.
     * 뒤바꿔도 타입이 통과하는 자리가 아니지만(배열 타입이 다름), 지표 축소판
     * (`getSeedBarsStatic`)이 `buySellVolume`을 보존한다는 전제가 깨지면 조용히
     * 빈 배열이 넘어간다 — 그 경우 점수가 항상 같은 값으로 굳는다.
     */
    it('봉과 buySellVolume을 그 순서로 넘겨 계산한다', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(mockComputeFearGreedIndex).toHaveBeenCalledWith(
            QUANTIZED.bars,
            QUANTIZED.indicators.buySellVolume
        );
    });

    it('봉 조회 실패 시 스냅샷은 null (칩이 "데이터 부족"으로 폴백)', async () => {
        mockGetSeedBarsStatic.mockRejectedValue(new Error('FMP down'));

        const tree = await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(headerPropsOf(tree)).toEqual(
            expect.objectContaining({ fearGreedSnapshot: null })
        );
        expect(mockComputeFearGreedIndex).not.toHaveBeenCalled();
    });

    it('assetInfo는 여전히 seed한다 (updatedAt 0으로 ISR 결정성 유지)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const assetSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'assetInfo'
        );
        expect(assetSeedCalls).toHaveLength(1);
        expect(assetSeedCalls[0][2]).toEqual({ updatedAt: 0 });
    });

    /**
     * 봉 조회 인자는 그대로 유지해야 한다 — page.tsx와 같은 인자여야 `React.cache`
     * 메모가 접혀 quantize가 요청당 한 번만 돈다. seed를 없앴다고 이 호출까지
     * 없앨 수는 없다(스냅샷 계산에 봉이 필요하다).
     */
    it('page.tsx와 같은 인자로 봉을 조회한다 (요청 스코프 메모 유지)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(mockGetSeedBarsStatic).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );
    });

    it('CRYPTO assetInfo → 헬퍼에 marketProfile "crypto"를 넘긴다', async () => {
        const cryptoAssetInfo = {
            symbol: 'BTCUSD',
            name: 'Bitcoin',
            marketProfile: 'crypto' as const,
        };
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: cryptoAssetInfo,
            degraded: false,
        });

        await SymbolLayoutChrome({
            assetInfo: cryptoAssetInfo,
            params: Promise.resolve({ symbol: 'btcusd' }),
        });

        expect(mockGetSeedBarsStatic).toHaveBeenCalledWith(
            'BTCUSD',
            '1Day',
            'crypto',
            undefined
        );
    });

    /**
     * 봉 조회가 실패해도(FMP 키 없음·degrade) throw하지 않고 스냅샷만 비운다.
     * 칩은 null 스냅샷에서 "데이터 부족" 문구로 폴백한다.
     */
    it('봉 조회 실패 시 throw하지 않는다', async () => {
        mockGetSeedBarsStatic.mockRejectedValue(new Error('FMP down'));

        await expect(
            SymbolLayoutChrome({
                assetInfo: ASSET_INFO,
                params: Promise.resolve({ symbol: 'aapl' }),
            })
        ).resolves.toBeDefined();

        const barsSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'bars'
        );
        expect(barsSeedCalls).toEqual([]);
    });
});

/**
 * 관련 종목 칩의 **위치 계약**.
 *
 * 칩은 원래 차트 페이지 `<main>` 안에 있었는데, 그 `<main>`은 차트 라우트에서
 * 자체 `overflow-y-auto` 스크롤 컨테이너다(jail이 definite height +
 * overflow-hidden이라 그 안에서 따로 스크롤된다). 그래서 칩이 중첩 스크롤러
 * 안쪽에 깔려, 사용자가 페이지를 내려 푸터를 봐도 도달하지 못했다 — DOM에는
 * 있어 크롤러는 봤지만 사람은 못 보는 상태였다(2026-08-25 사용자 제보).
 *
 * jail **밖**, floating chat **앞**에 두어야 페이지 일반 스크롤로 닿고 푸터
 * 바로 위에 놓인다. jail 안으로 되돌아가면 같은 결함이 재발한다.
 */
describe('SymbolLayout — 관련 종목 칩 위치 (jail 밖, 푸터 위)', () => {
    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
    });

    it('jail의 자식이 아니라 형제로 렌더된다', async () => {
        const tree = await SymbolLayout({
            children: null,
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const siblings = (tree as { props?: { children?: unknown } }).props
            ?.children;
        if (!Array.isArray(siblings)) {
            throw new Error('providers children is not an array');
        }

        const types = siblings.map(
            child => (child as { type?: unknown } | null)?.type
        );
        const jailIndex = types.indexOf(SymbolLayoutJail);
        const chipIndex = types.indexOf(RelatedSymbols);

        expect(jailIndex).toBeGreaterThan(-1);
        // jail의 **형제**여야 한다 — 자식이면 여기서 찾을 수 없다.
        expect(chipIndex).toBeGreaterThan(-1);
        // 푸터 위 자리 = jail 뒤.
        expect(chipIndex).toBeGreaterThan(jailIndex);
    });
});

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
