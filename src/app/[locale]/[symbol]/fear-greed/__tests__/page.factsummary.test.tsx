/**
 * Fear-greed page SSR factor summary wiring tests.
 *
 * Verifies `FearGreedFactsSummary` (server-computed, crawlable factor summary —
 * see Task 9) is mounted as a server sibling in the initial HTML:
 * - Happy: bars present → factor summary text appears in the rendered SSR tree.
 * - Worst: bars empty → factor summary absent, page still resolves.
 * - Worst: getSeedBarsStatic throws → factor summary absent, page still resolves
 *   (existing .catch(→null) degrade path, unchanged by this feature).
 *
 * `computeFearGreedIndex` itself is unit-tested by
 * FearGreedFactsSummary.test.tsx; this suite only verifies page-level wiring,
 * so `computeFearGreedIndex` is mocked to a fixed snapshot (mirrors the
 * FearGreedFactsSummary.test.tsx convention — real walk-forward fixtures need
 * 90+ bars, irrelevant to wiring).
 */

// TESTING.md#TE-1: all vi.mock + vi.hoisted declarations must come before imports.
const {
    mockGetAssetInfoResilient,
    mockGetQuantizedBarsStatic,
    mockGetSeedBarsStatic,
    mockGetQuantizedBarsSixHour,
    mockComputeFearGreedIndex,
    mockSetQueryData,
    mockShortenRevalidate,
    FIXED_SNAPSHOT,
} = vi.hoisted(() => ({
    mockShortenRevalidate: vi.fn(),
    mockSetQueryData: vi.fn(),
    mockComputeFearGreedIndex: vi.fn(),
    FIXED_SNAPSHOT: {
        score: 71,
        label: 'GREED',
        groups: [
            {
                name: 'Flow',
                score: 68,
                factors: [
                    { key: 'volume_z', rawValue: 1.1, percentile: 70 },
                    {
                        key: 'buysell_imbalance',
                        rawValue: 0.2,
                        percentile: 72,
                    },
                    {
                        key: 'poc_distance',
                        rawValue: 0.05,
                        percentile: 60,
                    },
                ],
            },
            {
                name: 'Trend',
                score: 74,
                factors: [
                    {
                        key: 'ma200_distance',
                        rawValue: 0.12,
                        percentile: 80,
                    },
                    {
                        key: 'range_position',
                        rawValue: 0.88,
                        percentile: 85,
                    },
                ],
            },
        ],
        confidence: 'normal',
        sampleSize: 300,
        warning: null,
    },
    mockGetAssetInfoResilient: vi.fn(),
    // 세션 키 축소 봉(`getSessionBarsStatic`). 페이지가 공포·탐욕 5년 일봉을 읽는 경로다.
    // (이름은 옛 헬퍼 이름을 유지한다 — 테스트 본문 수십 곳이 이 이름을 쓴다.)
    mockGetQuantizedBarsStatic: vi.fn(),
    // 축소판(`getSeedBarsStatic`). 5년 일봉을 버리므로 이 페이지는 부르면 안 된다.
    mockGetSeedBarsStatic: vi.fn(),
    // 6h 봉 캐시 원본. 이 탭에서는 부르면 안 된다(clamp).
    mockGetQuantizedBarsSixHour: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual('@y0ngha/siglens-core');
    return {
        ...actual,
        computeFearGreedIndex: (...args: unknown[]) =>
            mockComputeFearGreedIndex(...args),
    };
});

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    // children을 그대로 내보낸다 — 게이지(FearGreedPage 표식)가 요약보다 앞서는지 DOM으로 본다.
    HydrationBoundary: ({ children }: { children: React.ReactNode }) =>
        children,
    QueryClient: function MockQueryClientClass() {
        return { setQueryData: mockSetQueryData };
    },
}));

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

// 페이지는 5년 일봉이 담긴 세션 키 축소 봉(getSessionBarsStatic, revalidate 24h)을 쓴다.
// 6h 봉 캐시(barsStaticCache)는 읽으면 이 탭(24h 선언)이 6h로 clamp되므로 둘 다 부르면 안 된다 —
// 그 부재를 단언하려고 스파이로 남겨 둔다.
vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    getSessionBarsStatic: mockGetQuantizedBarsStatic,
}));
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsSixHour,
    getSeedBarsStatic: mockGetSeedBarsStatic,
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

// 순서·중복 억제 prop을 보려고 표식만 그린다. 게이지 자체는 FearGreedPage.test.tsx 소관.
// degraded 렌더의 revalidate 단축 호출만 본다(실제 핀은 Next 렌더 컨텍스트가 필요하다).
vi.mock('@/shared/cache/buildDegradedRevalidate', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/cache/buildDegradedRevalidate')
    >()),
    shortenRevalidateForRuntimeDegrade: mockShortenRevalidate,
}));
vi.mock('@/widgets/fear-greed/FearGreedPage', () => ({
    FearGreedPage: (props: {
        hideSelfNormWarning?: boolean;
        hideSampleFooter?: boolean;
        hasSeed?: boolean;
    }) => (
        <div
            data-testid="fear-greed-gauge"
            data-has-seed={String(props.hasSeed)}
            data-hide-self-norm={String(props.hideSelfNormWarning === true)}
            data-hide-sample-footer={String(props.hideSampleFooter === true)}
        />
    ),
}));
vi.mock('@/widgets/fear-greed/FearGreedPageError', () => ({
    FearGreedPageError: () => null,
}));
// Keep FearGreedFactsSummary real (subject under test) — only stub the
// unrelated heading component.
vi.mock('@/views/symbol/ui/SymbolPageHeading', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/views/symbol/ui/SymbolPageHeading')
    >()),
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    resolveSymbolFearGreedSeoContent: vi
        .fn()
        .mockReturnValue({ fullTitle: '', description: '', url: '' }),
    SITE_NAME: 'SIGLENS',
    SITE_URL: 'https://siglens.io',
    NOINDEX_SYMBOL_METADATA: {
        robots: { index: false, follow: true },
        alternates: { canonical: null },
    },
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SymbolFearGreedPage from '@/app/[locale]/[symbol]/fear-greed/page';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';
import { expectNoFaq } from '@/__tests__/utils/expectFaqSingleSource';

// 실제 코어는 봉이 없으면 null을 낸다("Returns null when bars is empty"). 모킹이 이를
// 흉내 내야 `hasFearGreedScore` 게이트가 실제와 같은 입력에서 같은 답을 한다.
beforeEach(() => {
    mockComputeFearGreedIndex.mockReset();
    mockComputeFearGreedIndex.mockImplementation((bars: unknown[]) =>
        bars.length === 0 ? null : FIXED_SNAPSHOT
    );
});

const EQUITY_ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    fmpSymbol: 'AAPL',
};

const BARS_WITH_DATA = {
    bars: [
        { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
        { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 120 },
    ],
    indicators: {
        // 실제 `getSeedBarsStatic` 산출물 모양을 따른다(`EMPTY_INDICATOR_RESULT`
        // 스프레드라 rsi·macd도 항상 배열이다). 게이트(`hasFearGreedScore`)와 요약은
        // `buySellVolume`만 읽고, 그 계산(`computeFearGreedIndex`)은 이 파일에서 목이다.
        rsi: [50, 55],
        macd: [{ histogram: 0.1 }, { histogram: 0.2 }],
        buySellVolume: [
            { buyVolume: 60, sellVolume: 40 },
            { buyVolume: 70, sellVolume: 50 },
        ],
    },
};

describe('SymbolFearGreedPage — SSR factor summary wiring', () => {
    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        // 리셋하지 않으면 앞 테스트의 mockResolvedValue가 새어 들어와, 실패 경로
        // 테스트가 실제로는 성공 경로를 타면서 통과한다(리뷰 R2에서 적발).
        mockGetQuantizedBarsStatic.mockReset();
        mockGetSeedBarsStatic.mockReset();
        mockGetQuantizedBarsSixHour.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });
    });

    it('회귀 방지: 봉·지표를 seed하지 않고 서버가 계산한 공포·탐욕 결과만 seed한다', async () => {
        // 클라이언트 게이지는 서버 계산 결과(`useFearGreedFromSymbol`)를 쓴다. 예전처럼
        // `QUERY_KEYS.bars`를 seed하면 일봉 500개+지표가 RSC에 다시 실린다 — 이 탭은
        // 한때 flight 630KB로 사이트 최대 페이지였다(2026-08 실측).
        // 6h 봉 캐시(`getQuantizedBarsStatic`·`getSeedBarsStatic`)는 부르지 않는다 —
        // 24h 탭이 6h로 clamp된다.
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const seededKeys = mockSetQueryData.mock.calls.map(([key]) => key[0]);
        expect(seededKeys).toContain('symbol-fear-greed');
        expect(seededKeys).not.toContain('bars');
        expect(mockGetSeedBarsStatic).not.toHaveBeenCalled();
        expect(mockGetQuantizedBarsSixHour).not.toHaveBeenCalled();
    });

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectSymbolBreadcrumbName('Apple Inc.');
    });

    it('Happy: bars 있으면 SSR HTML에 FearGreedFactsSummary 텍스트(점수·factor)가 렌더된다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.getByText(/AAPL 공포 탐욕 지수 요약/)
        ).toBeInTheDocument();
        expect(screen.getByText(/71 \/ 100/)).toBeInTheDocument();
        // 5개 지표는 표 하나로 — 행 머리글이 일반어 라벨이다.
        expect(
            screen.getByRole('rowheader', { name: /평소 대비 거래량 이탈/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('rowheader', { name: /최근 252봉 위치/ })
        ).toBeInTheDocument();
    });

    it('게이지(FearGreedPage)가 서버 계산 요약(FearGreedFactsSummary)보다 DOM에서 앞선다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        render(tree);

        const gauge = screen.getByTestId('fear-greed-gauge');
        const summary = screen
            .getByText(/AAPL 공포 탐욕 지수 요약/)
            .closest('section');
        expect(summary).not.toBeNull();
        expect(
            gauge.compareDocumentPosition(summary as Element) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('요약이 같은 문구를 그리므로 게이지의 경고 배지와 표본 안내를 끈다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        render(
            await SymbolFearGreedPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );

        const gauge = screen.getByTestId('fear-greed-gauge');
        expect(gauge).toHaveAttribute('data-hide-self-norm', 'true');
        expect(gauge).toHaveAttribute('data-hide-sample-footer', 'true');
    });

    it('Worst: bars 빈 배열이면 factor summary가 없고 페이지는 정상 resolve된다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue({
            bars: [],
            indicators: {},
        });

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.queryByText(/공포 탐욕 지수 요약/)
        ).not.toBeInTheDocument();
    });

    /**
     * 게이트(`hasFearGreedScore`)와 본문이 같은 core 계산으로 갈린다는 증거: 봉은
     * 있으나 `computeFearGreedIndex`가 null(점수 표본 부족)이면 요약을 그리지 않는다.
     * 옛 `buildTechnicalFacts` 판정이면 봉이 2개라 요약 렌더를 시도했을 조건이다.
     */
    it('Worst: 봉은 있으나 점수가 null이면 factor summary가 없다', async () => {
        mockComputeFearGreedIndex.mockReturnValue(null);
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.queryByText(/공포 탐욕 지수 요약/)
        ).not.toBeInTheDocument();
        expect(mockComputeFearGreedIndex).toHaveBeenCalled();
    });

    /**
     * 봉 조회가 실패하면 게이지에 seed가 없다고 알린다(`hasSeed={false}`). 그래야 게이지가 서버
     * 렌더에서 쿼리(Server Function)를 부르지 않는다 — 부르면 페이지 전체가 500이 됐다
     * (2026-10-07 운영). 그 degraded 렌더는 revalidate를 낮춰 24h 굳지 않게 한다.
     */
    it('봉 조회 실패 시 게이지에 hasSeed=false를 넘기고 revalidate를 낮춘다', async () => {
        mockShortenRevalidate.mockClear();
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('FMP 429'));

        render(
            await SymbolFearGreedPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );

        expect(screen.getByTestId('fear-greed-gauge')).toHaveAttribute(
            'data-has-seed',
            'false'
        );
        expect(mockShortenRevalidate).toHaveBeenCalled();
    });

    it('봉 조회 성공 시 게이지에 hasSeed=true를 넘기고 revalidate를 낮추지 않는다', async () => {
        mockShortenRevalidate.mockClear();
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        render(
            await SymbolFearGreedPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );

        expect(screen.getByTestId('fear-greed-gauge')).toHaveAttribute(
            'data-has-seed',
            'true'
        );
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });

    it('Worst: getSeedBarsStatic 실패(throw)해도 페이지가 깨지지 않고 factor summary는 생략된다', async () => {
        mockGetQuantizedBarsStatic.mockRejectedValue(
            new Error('bars infra down')
        );

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.queryByText(/공포 탐욕 지수 요약/)
        ).not.toBeInTheDocument();
    });

    /**
     * 회귀 가드: FAQPage 마크업과 화면 Q&A는 배열 하나에서 나와야 한다. 이 탭은
     * 오랫동안 마크업만 내보내고 화면에는 Q&A가 없었다 — 구글은 대응하는 내용이
     * 페이지에 보일 것을 요구하며, 없으면 리치 결과 자격을 잃는다. JSON-LD가
     * 유효한지만 보는 테스트로는 이 결함이 잡히지 않는다.
     */
    it('화면 FAQ는 렌더하고 FAQPage 구조화데이터는 싣지 않는다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectNoFaq(tree);
    });
});

/**
 * 상위 지수 링크는 종목이 속한 시장의 지수로 가야 한다. 암호화폐는 전용 지수가
 * 생기기 전까지 미국 페이지를 가리켰다.
 */
describe('SymbolFearGreedPage — 시장 지수 링크', () => {
    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockGetQuantizedBarsStatic.mockReset();
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);
    });

    it('암호화폐 종목은 /fear-greed/crypto로 링크한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'BTCUSD',
                name: 'Bitcoin USD',
                fmpSymbol: 'BTCUSD',
                marketProfile: 'crypto' as const,
            },
            degraded: false,
        });

        render(
            await SymbolFearGreedPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'btcusd' }),
            })
        );

        const link = screen.getByRole('link', {
            name: '암호화폐 시장 공포탐욕지수',
        });
        expect(link.getAttribute('href')).toMatch(/\/fear-greed\/crypto$/);
        expect(link.closest('p')).toHaveTextContent('암호화폐 시장 전체 흐름');
    });

    it('미국 종목은 여전히 /fear-greed로 링크한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });

        render(
            await SymbolFearGreedPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );

        const link = screen.getByRole('link', {
            name: '시장 전체 공포·탐욕 지수',
        });
        expect(link.getAttribute('href')).toMatch(/\/fear-greed$/);
    });
});
