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
 * so `computeFearGreedIndex` is mocked to a fixed snapshot (mirrors
 * useFearGreed.test.tsx / FearGreedFactsSummary.test.tsx convention — real
 * walk-forward fixtures need 90+ bars, irrelevant to wiring).
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const {
    mockGetAssetInfoResilient,
    mockGetSeedBarsStatic,
    mockGetQuantizedBarsStatic,
} = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
    // 축소되지 않은 전체 지표 헬퍼. 이 페이지는 절대 부르면 안 된다 — 아래 회귀 테스트 참조.
    mockGetQuantizedBarsStatic: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual('@y0ngha/siglens-core');
    return {
        ...actual,
        computeFearGreedIndex: vi.fn(() => ({
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
        })),
    };
});

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    HydrationBoundary: () => null,
    QueryClient: function MockQueryClientClass() {
        return { setQueryData: vi.fn() };
    },
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars', () => ({
    getSeedBarsStatic: mockGetSeedBarsStatic,
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/widgets/fear-greed/FearGreedPage', () => ({
    FearGreedPage: () => null,
}));
vi.mock('@/widgets/fear-greed', () => ({
    FearGreedPageError: () => null,
}));
// Keep FearGreedFactsSummary real (subject under test) — only stub the
// unrelated barrel export.
vi.mock('@/views/symbol', async importOriginal => ({
    ...(await importOriginal<typeof import('@/views/symbol')>()),
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
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({ url: '' }),
    resolveSymbolFearGreedSeoContent: vi
        .fn()
        .mockReturnValue({ fullTitle: '', description: '', url: '' }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
    NOINDEX_SYMBOL_METADATA: {
        robots: { index: false, follow: true },
        alternates: { canonical: null },
    },
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SymbolFearGreedPage from '@/app/[symbol]/fear-greed/page';

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
        mockGetSeedBarsStatic.mockReset();
        mockGetQuantizedBarsStatic.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: EQUITY_ASSET_INFO,
            degraded: false,
        });
    });

    it('회귀 방지: RQ seed는 축소판 헬퍼만 쓰고 전체 지표 헬퍼는 부르지 않는다', async () => {
        // 이 페이지만 `getQuantizedBarsStatic`(44개 지표 전부)을 seed하던 시기가 있었다.
        // layout은 `getSeedBarsStatic`(rsi·macd·buySellVolume만)을 seed하므로 참조가 갈려
        // **지표가 두 벌** 직렬화됐다 — 2026-08 프로덕션 실측 기준 flight 630KB 중 441KB,
        // gzip 149.9KB로 사이트 최대 페이지였다. 헬퍼를 되돌리면 그대로 재발한다.
        //
        // SSR 출력은 영향받지 않는다: 유일한 지표 소비자인 FearGreedFactsSummary의 props는
        // bars/buySellVolume 둘뿐이고, getSeedBarsStatic이 그 둘을 **같은 참조로** 넘긴다.
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(mockGetSeedBarsStatic).toHaveBeenCalled();
        expect(mockGetQuantizedBarsStatic).not.toHaveBeenCalled();
    });

    it('Happy: bars 있으면 SSR HTML에 FearGreedFactsSummary 텍스트(점수·factor)가 렌더된다', async () => {
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.getByText(/AAPL 공포 탐욕 지수 요약/)
        ).toBeInTheDocument();
        expect(screen.getByText(/71 \/ 100/)).toBeInTheDocument();
        expect(screen.getByText(/거래량 z/)).toBeInTheDocument();
        // FIX 6's factor-ranking narrative sentence can also mention "52주
        // 위치" when it's the most extreme factor — anchor on the
        // per-factor line's "라벨: 값" shape so this assertion targets only
        // that line.
        expect(screen.getByText(/52주 위치: /)).toBeInTheDocument();
    });

    it('Worst: bars 빈 배열이면 factor summary가 없고 페이지는 정상 resolve된다', async () => {
        mockGetSeedBarsStatic.mockResolvedValue({
            bars: [],
            indicators: {},
        });

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.queryByText(/공포 탐욕 지수 요약/)
        ).not.toBeInTheDocument();
    });

    it('Worst: getSeedBarsStatic 실패(throw)해도 페이지가 깨지지 않고 factor summary는 생략된다', async () => {
        mockGetSeedBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const tree = await SymbolFearGreedPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        render(tree);

        expect(
            screen.queryByText(/공포 탐욕 지수 요약/)
        ).not.toBeInTheDocument();
    });
});
