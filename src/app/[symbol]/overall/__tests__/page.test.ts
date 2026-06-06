/**
 * Overall page (narrative seed) 테스트. async 서버 컴포넌트는 RTL로 직접 렌더할
 * 수 없으므로(Promise<JSX.Element> 반환), 반환된 element 트리를 순회해
 * OverallContent에 전달된 initialAnalysis prop을 검증한다.
 */

// vi.mock은 hoist되지만 import/first와 가독성을 위해 모든 import 위에 둔다.
vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: vi.fn().mockReturnValue(false),
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/shared/lib/seo', async importOriginal => ({
    // 실제 seo를 스프레드해 NOINDEX_SYMBOL_METADATA 등 정적 export를 가져온다(drift 방지).
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 종합 분석',
        fullTitle: 'AAPL 종합 분석 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL/overall',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekOverallAnalysisCache: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));
// /news와 동일 게이트(useWaitForNewsCards) 적용을 위해 newsItems를 SSR에서 조회한다.
// getNewsList는 entities/news-article로 이동 — barrel mock.
vi.mock('@/entities/news-article', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/news-article')>()),
    getNewsList: vi.fn().mockResolvedValue([]),
}));

import {
    generateMetadata,
    default as OverallPage,
    revalidate,
} from '@/app/[symbol]/overall/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    GEMINI_2_5_FLASH_LITE_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockPeekOverall = peekOverallAnalysisCache as MockedFunction<
    typeof peekOverallAnalysisCache
>;

describe('Overall page ISR route config', () => {
    it('exports revalidate = 43200 (literal — required for Next.js static analysis)', () => {
        // MISTAKES §15: route segment config must be a literal, not an imported constant
        expect(revalidate).toBe(43200);
    });
});

describe('generateMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('returns noindex when degraded on infra failure', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'AAPL' },
            degraded: true,
        } as never);

        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
    });

    it('returns normal metadata when not degraded', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });

    it('returns noindex for invalid ticker', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ symbol: '!!!invalid' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
    });
});

describe('Overall page (narrative seed)', () => {
    interface OverallSeedProps {
        initialAnalysis: unknown;
        hasEnrichedNews: boolean;
    }

    // describe 내부에 두어 beforeEach가 설정하는 mock 의존성과 co-locate한다
    // (모듈 최상위에 두면 setup 의존이 암묵적이라는 리뷰 제안 반영).
    async function getOverallProps(): Promise<OverallSeedProps> {
        const tree = await OverallPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });
        const content = findElementByType(tree, OverallContent);
        if (content === null) {
            throw new Error('OverallContent not found in tree');
        }
        return content.props as OverallSeedProps;
    }

    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockPeekOverall.mockReset();
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

    it('peek HIT 시 캐시된 종합 분석을 initialAnalysis로 전달한다', async () => {
        const cached = { headlineKo: 'cached overall' };
        mockPeekOverall.mockResolvedValue(cached as never);

        const props = await getOverallProps();

        expect(mockPeekOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            GEMINI_2_5_FLASH_LITE_MODEL
        );
        expect(props.initialAnalysis).toEqual(cached);
    });

    it('peek MISS(null) 시 initialAnalysis로 undefined를 전달한다', async () => {
        mockPeekOverall.mockResolvedValue(null);

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });

    it('peek가 throw해도 크래시 없이 undefined로 degrade한다', async () => {
        mockPeekOverall.mockRejectedValue(new Error('redis down'));

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });

    // hasEnrichedNews 분기 (MISTAKES.md §Tests 18): true/false 두 경로 모두 검증.
    // /news와 동일 게이트로 client(useWaitForNewsCards)가 SSR snapshot의 enrichment
    // 여부를 보고 즉시 ready 결정하거나 폴링을 시작해야 한다.
    it('hasEnrichedNews=false: getNewsList가 빈 배열이면 false 전달 (게이트 폴링 시작)', async () => {
        mockPeekOverall.mockResolvedValue(null);
        // 모듈 상단 vi.mock 기본값(빈 배열)을 그대로 사용해 false 경로를 검증.
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(false);
    });

    it('모든 row가 미분석(sentiment=null)이면 hasEnrichedNews=false 전달', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockResolvedValueOnce([
            { id: 'r1', sentiment: null } as never,
            { id: 'r2', sentiment: null } as never,
        ]);
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(false);
    });

    it('hasEnrichedNews=true: enriched row(sentiment!==null)가 1개라도 있으면 true 전달 (게이트 즉시 통과)', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockResolvedValueOnce([
            { id: 'r1', sentiment: null } as never,
            { id: 'r2', sentiment: 'bullish' } as never,
            { id: 'r3', sentiment: null } as never,
        ]);
        const props = await getOverallProps();
        expect(props.hasEnrichedNews).toBe(true);
    });

    it('getNewsList가 throw해도 ISR-safe하게 hasEnrichedNews=false로 degrade한다', async () => {
        mockPeekOverall.mockResolvedValue(null);
        const { getNewsList } = await import('@/entities/news-article');
        (
            getNewsList as MockedFunction<typeof getNewsList>
        ).mockRejectedValueOnce(new Error('db down'));
        const props = await getOverallProps();
        // 페이지가 throw 안 함 + hasEnrichedNews=false로 client가 폴링 시작
        expect(props.hasEnrichedNews).toBe(false);
    });
});
