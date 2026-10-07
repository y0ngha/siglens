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
 * - 칩은 세션 키 스냅샷 캐시(`getSymbolFearGreedChipStatic`)에서 읽고 **6h 봉 캐시는 읽지
 *   않는다** — 레이아웃은 9탭 공유라, 6h 봉 캐시를 읽으면 12h·24h 탭이 전부 6h로 clamp된다
 *   (Next 16.3 `unstable_cache` revalidate lowering, 2026-10 운영 실측)
 * - 조회 실패 시 throw 없이 스냅샷만 null
 */

// TESTING.md#TE-1: 모든 vi.mock + 변수 선언은 import 위로(import/first 규칙).
// vi.hoisted로 mock 변수를 호이스트해 vi.mock 콜백에서 참조 가능하게 한다.
const {
    MOCK_EMPTY_INDICATOR_RESULT,
    mockSetQueryData,
    mockPrefetchQuery,
    mockGetAssetInfoResilient,
    mockNotFound,
    mockGetQuantizedBarsStatic,
    mockGetSeedBarsStatic,
    mockGetSymbolFearGreedChipStatic,
} = vi.hoisted(() => ({
    MOCK_EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} } as never,
    mockSetQueryData: vi.fn(),
    mockGetSymbolFearGreedChipStatic: vi.fn(),
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
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    EMPTY_INDICATOR_RESULT: MOCK_EMPTY_INDICATOR_RESULT,
    // `FearGreedFactsSummary`(fearGreedLabels)가 import 그래프에 들어오면 모듈
    // 스코프에서 이 상수를 읽는다. 레이아웃 자체는 쓰지 않는다.
    POC_WINDOW_DEFAULT: 60,
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

vi.mock('@/app/[locale]/[symbol]/SymbolLayoutClient', () => ({
    SymbolLayoutProviders: () => null,
}));
vi.mock('@/app/[locale]/[symbol]/SymbolLayoutJail', () => ({
    SymbolLayoutJail: () => null,
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

vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

// 레이아웃은 6h 봉 캐시(barsStaticCache)를 **읽지 않아야** 한다 — 스파이로 두어 호출 부재를
// 단언한다. 칩은 세션 키 스냅샷 캐시에서 읽는다(스냅샷 계산 자체는
// `sessionBarsStaticCache.test.ts`가 검증한다).
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: mockGetSeedBarsStatic,
}));
vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    getSymbolFearGreedChipStatic: mockGetSymbolFearGreedChipStatic,
}));

import { Suspense } from 'react';
vi.mock('@/features/visitor-ping/ui/SymbolViewPing', () => ({
    SymbolViewPing: function SymbolViewPing() {
        return null;
    },
}));

import SymbolLayout, {
    SymbolLayoutChrome,
} from '@/app/[locale]/[symbol]/layout';
import { SymbolLayoutJail } from '@/app/[locale]/[symbol]/SymbolLayoutJail';
import { RelatedSymbols } from '@/views/symbol/RelatedSymbols';
import { AskAiFab } from '@/widgets/ask-ai-fab/AskAiFab';
import { SymbolViewPing } from '@/features/visitor-ping/ui/SymbolViewPing';

const ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};
const CHIP_SNAPSHOT = {
    score: 42,
    label: 'NEUTRAL' as const,
    confidence: 'full' as const,
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
        mockGetQuantizedBarsStatic.mockClear();
        mockGetSeedBarsStatic.mockClear();
        mockGetSymbolFearGreedChipStatic.mockReset();
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
        mockGetSymbolFearGreedChipStatic.mockResolvedValue(CHIP_SNAPSHOT);
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
     * **clamp 회귀 가드.** 레이아웃은 9개 탭 전부가 공유한다. 여기서 6h 봉 캐시
     * (`getQuantizedBarsStatic`/`getSeedBarsStatic` → `getBarsStatic`)를 읽으면 Next 16.3이
     * 12h·24h를 선언한 탭까지 6h로 clamp한다(2026-10 운영 실측: `/AAPL/fundamental`
     * s-maxage 21600). 칩은 세션 키 스냅샷 캐시(revalidate 24h)만 읽어야 한다.
     */
    it('6h 봉 캐시를 읽지 않는다 (9탭 revalidate clamp 회귀 가드)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetQuantizedBarsStatic).not.toHaveBeenCalled();
        expect(mockGetSeedBarsStatic).not.toHaveBeenCalled();
        expect(mockGetSymbolFearGreedChipStatic).toHaveBeenCalledTimes(1);
    });

    it('칩 조회 실패 시 스냅샷은 null (칩이 "데이터 부족"으로 폴백)', async () => {
        mockGetSymbolFearGreedChipStatic.mockRejectedValue(
            new Error('FMP down')
        );
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const tree = await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(headerPropsOf(tree)).toEqual(
            expect.objectContaining({ fearGreedSnapshot: null })
        );
        errorSpy.mockRestore();
    });

    it('assetInfo는 여전히 seed한다 (updatedAt 0으로 ISR 결정성 유지)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const assetSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'assetInfo'
        );
        expect(assetSeedCalls).toHaveLength(1);
        expect(assetSeedCalls[0][2]).toEqual({ updatedAt: 0 });
    });

    /**
     * 장애 폴백으로 푼 assetInfo는 다른 고정값으로 심는다 — 클라이언트(`useAssetInfo`)가
     * 그 시드만 stale로 보고 다시 받아 스스로 고친다. 정상 시드와 같은 값이면 장애 중에
     * 구워진 ISR HTML의 폴백 값이 새로고침 전까지 남는다.
     */
    it('degraded면 시드를 다른 고정 updatedAt으로 심는다 (값은 재생성마다 같다)', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            degraded: true,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const assetSeedCalls = mockSetQueryData.mock.calls.filter(
            ([key]) => Array.isArray(key) && key[0] === 'assetInfo'
        );
        expect(assetSeedCalls).toHaveLength(1);
        expect(assetSeedCalls[0][2]).toEqual({ updatedAt: 1 });
    });

    /**
     * 칩 조회 인자 — 대문자 ticker·시장 프로필·FMP 심볼. 공포·탐욕 탭 본문
     * (`getSessionBarsStatic`)과 같은 세션 키 규칙(시장 프로필의 세션 스펙)을 타야
     * 그 탭에서 칩과 본문 요약이 같은 점수다.
     */
    it('대문자 ticker·시장 프로필·FMP 심볼로 칩을 조회한다', async () => {
        await SymbolLayoutChrome({
            assetInfo: ASSET_INFO,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetSymbolFearGreedChipStatic).toHaveBeenCalledWith(
            'AAPL',
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
            params: Promise.resolve({ locale: 'ko', symbol: 'btcusd' }),
        });

        expect(mockGetSymbolFearGreedChipStatic).toHaveBeenCalledWith(
            'BTCUSD',
            'crypto',
            undefined
        );
    });

    /**
     * 봉 조회가 실패해도(FMP 키 없음·degrade) throw하지 않고 스냅샷만 비운다.
     * 칩은 null 스냅샷에서 "데이터 부족" 문구로 폴백한다.
     */
    it('칩 조회 실패 시 throw하지 않는다', async () => {
        mockGetSymbolFearGreedChipStatic.mockRejectedValue(
            new Error('FMP down')
        );
        vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            SymbolLayoutChrome({
                assetInfo: ASSET_INFO,
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
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
 * 칩은 원래 차트 페이지 `<main>` 안에 있었는데, 그때 그 `<main>`은 차트 라우트에서
 * 자체 `overflow-y-auto` 스크롤 컨테이너였다(jail이 definite height +
 * overflow-hidden이라 그 안에서 따로 스크롤됐다). 그래서 칩이 중첩 스크롤러
 * 안쪽에 깔려, 사용자가 페이지를 내려 푸터를 봐도 도달하지 못했다 — DOM에는
 * 있어 크롤러는 봤지만 사람은 못 보는 상태였다(2026-08-25 사용자 제보).
 *
 * 그 `<main>` 스크롤러 자체는 이후 걷어냈지만(`<main>`·jail은 스크롤하지 않는다), 칩의 자리는
 * 그대로 유지한다 — 푸터 바로 위가 이 칩의 제자리다.
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
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        // 루트는 `RouteMessages`(라우트별 클라이언트 메시지)이고 그 자식이
        // `SymbolLayoutProviders`다. 형제 배열은 프로바이더 안쪽에 있다.
        const providers = (tree as { props?: { children?: unknown } }).props
            ?.children;
        const siblings = (providers as { props?: { children?: unknown } })
            ?.props?.children;
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

    it('정규(대문자) 심볼로 조회수 비콘을 마운트한다', async () => {
        const tree = await SymbolLayout({
            children: null,
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        const providers = (tree as { props?: { children?: unknown } }).props
            ?.children;
        const siblings = (providers as { props?: { children?: unknown } })
            ?.props?.children;
        if (!Array.isArray(siblings)) {
            throw new Error('providers children is not an array');
        }
        const ping = siblings.find(
            child =>
                (child as { type?: unknown } | null)?.type === SymbolViewPing
        ) as { props: { symbol: string } } | undefined;

        expect(ping?.props.symbol).toBe('AAPL');
    });
});

/**
 * 예전 자체 챗봇 플로팅 버튼(`SymbolLayoutFloatingChat`)의 후임인 `AskAiFab`
 * 배선 — 레이아웃이 실제로 해석한 종목명·로케일 접두 경로를 넘기는지 합성
 * 단계에서 고정한다. 레이아웃은 이미 확정한 `assetInfo`·`locale`로 값을 바로
 * 계산해 `AskAiFab`을 **인라인으로** 렌더한다 — 서버 데이터 Suspense 경계 뒤에
 * 두면 링크가 raw HTML 끝의 숨김 청크로 밀린다.
 */
describe('SymbolLayout — AskAiFab 배선 (인라인, Suspense 없음)', () => {
    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: ASSET_INFO,
            degraded: false,
        });
    });

    async function renderSiblings(locale: string): Promise<unknown[]> {
        const tree = await SymbolLayout({
            children: null,
            params: Promise.resolve({ locale, symbol: 'aapl' }),
        });
        const providers = (tree as { props?: { children?: unknown } }).props
            ?.children;
        const siblings = (providers as { props?: { children?: unknown } })
            ?.props?.children;
        if (!Array.isArray(siblings)) {
            throw new Error('providers children is not an array');
        }
        return siblings;
    }

    it('AskAiFab에 해석된 종목명과 로케일 접두 경로를 넘긴다', async () => {
        const siblings = await renderSiblings('ko');
        const fabElement = siblings.find(
            child => (child as { type?: unknown } | null)?.type === AskAiFab
        ) as { props?: Record<string, unknown> } | undefined;

        expect(fabElement?.props).toEqual({
            name: 'Apple Inc.',
            localePrefix: '/',
        });
    });

    it('비기본 로케일이면 접두 경로가 그 로케일을 따른다', async () => {
        const siblings = await renderSiblings('en');
        const fabElement = siblings.find(
            child => (child as { type?: unknown } | null)?.type === AskAiFab
        ) as { props?: Record<string, unknown> } | undefined;

        expect(fabElement?.props?.localePrefix).toBe('/en');
    });

    it('레이아웃 직속 형제에 Suspense 경계가 없다', async () => {
        const siblings = await renderSiblings('ko');
        expect(
            siblings.some(
                child => (child as { type?: unknown } | null)?.type === Suspense
            )
        ).toBe(false);
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
            params: Promise.resolve({ locale: 'ko', symbol }),
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
