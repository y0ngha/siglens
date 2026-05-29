vi.mock('@/widgets/symbol-page/SymbolPageClient', () => ({
    SymbolPageClient: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/chat-message', () => ({
    FALLBACK_ANALYSIS: { summary: 'fallback' },
}));
vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekAnalysisCache: vi.fn(),
}));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: vi.fn().mockReturnValue(false),
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoCached: vi.fn(),
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn().mockResolvedValue({ bars: [] }),
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
vi.mock('@/shared/lib/seo', () => ({
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
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

import { generateMetadata, default as SymbolPage } from '@/app/[symbol]/page';
import { getAssetInfoCached } from '@/entities/ticker';
import { peekAnalysisCache } from '@y0ngha/siglens-core';
import { SymbolPageClient } from '@/widgets/symbol-page/SymbolPageClient';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoCached = getAssetInfoCached as MockedFunction<
    typeof getAssetInfoCached
>;
const mockPeekAnalysisCache = peekAnalysisCache as MockedFunction<
    typeof peekAnalysisCache
>;

/**
 * 렌더 없이 RSC가 반환한 element 트리를 재귀 순회해 주어진 컴포넌트 타입의
 * 첫 element를 찾는다. async 서버 컴포넌트(page.tsx)는 @testing-library/react로
 * 직접 렌더할 수 없으므로(Promise<JSX.Element> 반환), props 주입 검증은 트리
 * 탐색으로 수행한다.
 */
function findElementByType(
    node: ReactNode,
    type: unknown
): ReactElement | null {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findElementByType(child, type);
            if (found !== null) return found;
        }
        return null;
    }
    if (!isValidElement(node)) return null;
    if (node.type === type) return node;
    const childProps = node.props as { children?: ReactNode };
    return findElementByType(childProps.children, type);
}

interface ClientSeedProps {
    initialAnalysis: unknown;
    initialAnalysisFailed: unknown;
}

describe('Symbol page', () => {
    describe('generateMetadata', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('returns noindex for invalid ticker', async () => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: '!!!invalid' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.robots).toEqual(
                expect.objectContaining({ index: false })
            );
        });

        it('returns metadata with title for valid ticker', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.title).toBe('AAPL 차트');
        });

        it('adds noindex when tf query param is present', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({ tf: '1Hour' }),
            });

            expect(metadata.robots).toEqual(
                expect.objectContaining({ index: false })
            );
        });

        it('does not add noindex when no tf param', async () => {
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);

            const metadata = await generateMetadata({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({}),
            });

            expect(metadata.robots).toBeUndefined();
        });
    });

    describe('SymbolPage (narrative seed)', () => {
        beforeEach(() => {
            // vi.clearAllMocks()를 쓰지 않는 이유: QueryClient 등 mockImplementation
            // 으로 구성한 모듈 모킹의 구현까지 지워져 생성자 모킹이 깨진다. 이 블록이
            // 의존하는 두 mock만 선택적으로 초기화한다.
            mockGetAssetInfoCached.mockReset();
            mockPeekAnalysisCache.mockReset();
            mockGetAssetInfoCached.mockResolvedValue({
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            } as never);
        });

        async function getClientProps(): Promise<ClientSeedProps> {
            const tree = await SymbolPage({
                params: Promise.resolve({ symbol: 'aapl' }),
                searchParams: Promise.resolve({}),
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
                'gemini-2.5-flash-lite'
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
    });
});
