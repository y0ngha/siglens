vi.mock('@/views/symbol/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    FALLBACK_ANALYSIS: { summary: 'fallback' },
}));
vi.mock('@y0ngha/siglens-core', () => ({
    DEEPSEEK_V4_FLASH_MODEL: 'deepseek-v4-flash',
    peekAnalysisCache: vi.fn(),
}));
vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/symbol-indexability', () => ({
    evaluateSymbolIndexability: vi.fn(() => ({
        indexable: true,
        reason: 'popular',
    })),
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn().mockResolvedValue({ bars: [] }),
}));
// page.tsx calls sessionSpecFor(marketProfile) before quantize — stub it out so the
// core-level constants (US_EQUITY_SESSION) are not required in the partial core mock above.
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(() => ({})),
}));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
    }),
}));
vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_KEYS: {
        assetInfo: (s: string) => ['assetInfo', s],
        bars: (s: string, t: string) => ['bars', s, t],
    },
    QUERY_STALE_TIME_MS: 5000,
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    // 실제 seo 모듈을 스프레드해 NOINDEX_SYMBOL_METADATA 같은 정적 export를 그대로
    // 가져온다(상수 인라인 복제 → drift 방지). 빌더만 아래에서 결정적으로 오버라이드한다.
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 차트',
        fullTitle: 'AAPL 차트 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL',
        keywords: ['AAPL'],
    }),
    // page.tsx delegates SEO content selection to resolveSymbolSeoContent, so
    // the mock must cover it directly (the real helper calls buildSymbolSeoContent
    // at module-scope, bypassing the mock above when spread via importOriginal).
    resolveSymbolSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 차트',
        fullTitle: 'AAPL 차트 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@tanstack/react-query', () => ({
    dehydrate: vi.fn().mockReturnValue({}),
    HydrationBoundary: () => null,
    // 클래스로 모킹한다: page.tsx가 `new QueryClient(...)`로 생성하므로
    // 화살표 함수 구현(vi.fn().mockImplementation(() => ...))은 생성자로 쓸 수 없다.
    QueryClient: class {
        setQueryData = vi.fn();
        prefetchQuery = vi.fn();
    },
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import {
    generateMetadata,
    default as SymbolPage,
    revalidate,
} from '@/app/[symbol]/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    DEEPSEEK_V4_FLASH_MODEL,
    peekAnalysisCache,
} from '@y0ngha/siglens-core';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { notFound } from 'next/navigation';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockPeekAnalysisCache = peekAnalysisCache as MockedFunction<
    typeof peekAnalysisCache
>;
const mockEvaluateSymbolIndexability =
    evaluateSymbolIndexability as MockedFunction<
        typeof evaluateSymbolIndexability
    >;

interface ClientSeedProps {
    initialAnalysis: unknown;
    initialAnalysisFailed: unknown;
}

describe('Symbol page', () => {
    describe('ISR route config', () => {
        it('exports revalidate = 21600 (literal — required for Next.js static analysis)', () => {
            // MISTAKES §15: route segment config must be a literal, not an imported constant
            expect(revalidate).toBe(21600);
        });
    });

    describe('generateMetadata', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            mockEvaluateSymbolIndexability.mockImplementation(
                ({ assetInfo, degraded }) => {
                    if (degraded) {
                        return { indexable: false, reason: 'degraded' };
                    }
                    if (assetInfo === null) {
                        return { indexable: false, reason: 'asset-missing' };
                    }
                    return { indexable: true, reason: 'popular' };
                }
            );
        });

        it('returns noindex for invalid ticker', async () => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '!!!invalid' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: false });
        });

        it('returns metadata with title for valid ticker', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.title).toBe('AAPL 차트');
        });

        it('canonical excludes tf — ISR page uses clean canonical regardless of query params', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            // ISR 페이지: searchParams 없이 렌더되므로 canonical은 clean URL
            expect(metadata.robots).toBeUndefined();
            expect(metadata.alternates?.canonical).toBe(
                'https://siglens.io/AAPL'
            );
        });

        it('does not add noindex when no tf param', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.robots).toBeUndefined();
        });

        it('returns noindex when getAssetInfoResilient degrades on infra failure', async () => {
            // 인프라 실패 시 fallback의 종목 실재 여부가 불명하므로 검색 노출을 막는다.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: 'AAPL', name: 'AAPL' },
                degraded: true,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: false });
        });

        it('gate blocked unapproved longtail returns noindex', async () => {
            const assetInfo = {
                symbol: '0NEUSD',
                name: 'Stone USD',
            };
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo,
                degraded: false,
            } as never);
            mockEvaluateSymbolIndexability.mockReturnValueOnce({
                indexable: false,
                reason: 'longtail-default-blocked',
            });

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '0NEUSD' }),
            });

            expect(metadata.robots).toEqual({ index: false, follow: false });
            expect(mockEvaluateSymbolIndexability).toHaveBeenCalledWith({
                symbol: '0NEUSD',
                assetInfo,
                degraded: false,
            });
        });

        it('gate allowed curated crypto keeps metadata indexable', async () => {
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'BTCUSD',
                    name: 'Bitcoin USD',
                    fmpSymbol: 'BTCUSD',
                },
                degraded: false,
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });

            expect(metadata.robots).toBeUndefined();
        });
    });

    describe('SymbolPage (narrative seed)', () => {
        beforeEach(() => {
            // vi.clearAllMocks()를 쓰지 않는 이유: QueryClient 등 mockImplementation
            // 으로 구성한 모듈 모킹의 구현까지 지워져 생성자 모킹이 깨진다. 이 블록이
            // 의존하는 두 mock만 선택적으로 초기화한다.
            mockGetAssetInfoResilient.mockReset();
            mockPeekAnalysisCache.mockReset();
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    koreanName: '애플',
                    fmpSymbol: 'AAPL',
                },
                degraded: false,
            } as never);
        });

        async function getClientProps(): Promise<ClientSeedProps> {
            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const client = findElementByType(tree, SymbolPageClient);
            if (client === null) {
                throw new Error('SymbolPageClient not found in tree');
            }
            return client.props as ClientSeedProps;
        }

        it('peek HIT 시 캐시된 분석을 initialAnalysis로 전달한다', async () => {
            const cached = { summary: 'cached analysis' };
            mockPeekAnalysisCache.mockResolvedValue(cached as never);

            const props = await getClientProps();

            expect(mockPeekAnalysisCache).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'AAPL',
                DEEPSEEK_V4_FLASH_MODEL
            );
            expect(props.initialAnalysis).toEqual(cached);
        });

        it('peek MISS(null) 시 FALLBACK_ANALYSIS를 전달한다', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const props = await getClientProps();

            expect(props.initialAnalysis).toEqual({ summary: 'fallback' });
        });

        it('peek가 throw해도 크래시 없이 FALLBACK_ANALYSIS로 degrade한다', async () => {
            mockPeekAnalysisCache.mockRejectedValue(new Error('redis down'));

            const props = await getClientProps();

            expect(props.initialAnalysis).toEqual({ summary: 'fallback' });
        });

        it('seed 여부와 무관하게 initialAnalysisFailed=true를 유지한다 (순수 additive)', async () => {
            mockPeekAnalysisCache.mockResolvedValue({
                summary: 'cached analysis',
            } as never);

            const props = await getClientProps();

            expect(props.initialAnalysisFailed).toBe(true);
        });

        it('peek MISS 시에도 initialAnalysisFailed=true를 유지한다', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const props = await getClientProps();

            expect(props.initialAnalysisFailed).toBe(true);
        });

        it('does not render chart FAQ JSON-LD', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const serialized = JSON.stringify(tree);

            expect(serialized).not.toContain('FAQPage');
        });

        it('does not render hidden keyword stuffing copy', async () => {
            mockPeekAnalysisCache.mockResolvedValue(null);

            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const serialized = JSON.stringify(tree);

            expect(serialized).not.toContain('도지나 해머');
            expect(serialized).not.toContain('볼린저밴드');
            expect(serialized).not.toContain('보조지표 13종');
        });
    });

    describe('SymbolPage — notFound gate (degraded path)', () => {
        const mockNotFound = notFound as MockedFunction<typeof notFound>;

        beforeEach(() => {
            // Reset all mocks so prior test state (e.g. peekAnalysisCache calls
            // from the narrative-seed suite) does not pollute these assertions.
            vi.clearAllMocks();
            // Restore stable defaults cleared by vi.clearAllMocks().
            mockPeekAnalysisCache.mockResolvedValue(null);
        });

        it('branch-taken: degraded + non-US ticker shape calls notFound()', async () => {
            // 1INCHUSD starts with a digit → fails VALID_TICKER_RE (^[A-Z]…)
            // and represents a crypto symbol that cannot be resolved when both
            // crypto_assets DB and FMP are down simultaneously.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: { symbol: '1INCHUSD', name: '1inch' },
                degraded: true,
            } as never);

            await SymbolPage({
                params: Promise.resolve({ symbol: '1INCHUSD' }),
            });

            expect(mockNotFound).toHaveBeenCalled();
        });

        it('branch-not-taken: degraded + valid US ticker shape does NOT call notFound() for the degraded gate', async () => {
            // AAPL passes VALID_TICKER_RE: a US equity that is temporarily
            // degraded due to FMP downtime should continue to render (with
            // the existing noindex metadata guard), not 404.
            mockGetAssetInfoResilient.mockResolvedValue({
                assetInfo: {
                    symbol: 'AAPL',
                    name: 'Apple Inc.',
                    fmpSymbol: 'AAPL',
                },
                degraded: true,
            } as never);

            await SymbolPage({
                params: Promise.resolve({ symbol: 'AAPL' }),
            });

            expect(mockNotFound).not.toHaveBeenCalled();
        });
    });
});
