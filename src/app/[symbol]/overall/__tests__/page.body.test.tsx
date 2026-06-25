/**
 * Overall page body branching tests — verifies crypto-vs-equity copy in:
 *   1. SymbolPageHeading (visible h1 region)
 *   2. sr-only description paragraph
 *   3. Visible 3-paragraph guide section
 *   4. FAQ JSON-LD `mainEntity[*].acceptedAnswer.text` answers
 *
 * Strategy: invoke the RSC directly (no DOM render) and JSON.stringify the tree
 * to assert presence/absence of branch-specific strings, mirroring the pattern
 * in `src/app/[symbol]/news/__tests__/page.body.test.tsx`.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
    getAssetInfoResilient: vi.fn(),
}));

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

vi.mock('@/entities/news-article', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/overall', () => ({
    OverallFactsSummary: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        url: 'https://siglens.io/AAPL',
    }),
    resolveSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | Siglens',
        description: 'd',
        url: 'https://siglens.io/AAPL/overall',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekOverallAnalysisCache: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/config/market', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/market')>()),
    DEFAULT_TIMEFRAME: '1Day',
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import OverallPage from '@/app/[symbol]/overall/page';
import { getAssetInfoResilient } from '@/entities/ticker';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);

const EQUITY_ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
        marketProfile: 'us-equity' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

const CRYPTO_ASSET_INFO = {
    assetInfo: {
        symbol: 'BTCUSD',
        name: 'Bitcoin',
        koreanName: '비트코인',
        // fmpSymbol is null for crypto — the type requires string|undefined, so we
        // cast through unknown to represent the real runtime shape that the DB returns.
        fmpSymbol: null as unknown as string | undefined,
        marketProfile: 'crypto' as const,
    },
    degraded: false,
} as Awaited<ReturnType<typeof getAssetInfoResilient>>;

describe('OverallPage — isEquity body branching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('SymbolPageHeading (h1 region)', () => {
        it('crypto → heading uses 차트와 뉴스, 매수 분위기 종합 분석', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('차트와 뉴스, 매수 분위기 종합 분석');
            // equity-only heading must be absent
            expect(treeStr).not.toContain(
                '차트와 옵션 시장, 실적, 뉴스 종합 분석'
            );
        });

        it('equity → heading uses 차트와 옵션 시장, 실적, 뉴스 종합 분석', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('차트와 옵션 시장, 실적, 뉴스 종합 분석');
            expect(treeStr).not.toContain('차트와 뉴스, 매수 분위기 종합 분석');
        });
    });

    describe('sr-only description paragraph', () => {
        it('crypto → sr-only uses 기술적 분석, 뉴스, 공포 탐욕 지수를 통합', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain(
                '기술적 분석, 뉴스, 공포 탐욕 지수를 통합한 결론'
            );
            // equity-only text must be absent
            expect(treeStr).not.toContain(
                '펀더멘털, 뉴스, 옵션, 공포 탐욕 지수의 5축'
            );
        });

        it('equity → sr-only uses 기술적 분석, 펀더멘털, 뉴스, 옵션, 공포 탐욕 지수의 5축', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain(
                '기술적 분석, 펀더멘털, 뉴스, 옵션, 공포 탐욕 지수의 5축'
            );
            expect(treeStr).not.toContain(
                '기술적 분석, 뉴스, 공포 탐욕 지수를 통합한 결론'
            );
        });
    });

    describe('visible guide section body (3 paragraphs)', () => {
        it('crypto → body contains 매수 분위기(공포 탐욕 지수)', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('매수 분위기(공포 탐욕 지수)');
        });

        it('crypto → body does NOT contain 옵션 시장이 평가하는 단기 방향성', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → body contains 옵션 시장이 평가하는 단기 방향성', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → body contains 분기 실적 흐름', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('분기 실적 흐름');
        });
    });

    describe('FAQ JSON-LD answer branching', () => {
        it('crypto → FAQ answer contains 매수 분위기(공포 탐욕 지수)를 묶어 강세와 약세', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain(
                '매수 분위기(공포 탐욕 지수)를 묶어 강세와 약세'
            );
            // equity-only FAQ text must be absent
            expect(treeStr).not.toContain('옵션 시장이 평가하는 단기 방향성');
        });

        it('equity → FAQ answer contains 옵션 시장의 콜·풋 베팅 분위기', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('옵션 시장의 콜·풋 베팅 분위기');
            expect(treeStr).not.toContain(
                '매수 분위기(공포 탐욕 지수)를 묶어 강세와 약세'
            );
        });

        it('crypto → FAQ risk answer contains 규제 이슈, 대형 뉴스', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'BTCUSD' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('규제 이슈, 대형 뉴스');
            // equity-only risk text
            expect(treeStr).not.toContain('실적 발표 결과나 가이던스 변화');
        });

        it('equity → FAQ risk answer contains 실적 발표 결과나 가이던스 변화', async () => {
            mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
            const tree = await OverallPage({
                params: Promise.resolve({ symbol: 'aapl' }),
            });
            const treeStr = JSON.stringify(tree);
            expect(treeStr).toContain('실적 발표 결과나 가이던스 변화');
            expect(treeStr).not.toContain('규제 이슈, 대형 뉴스');
        });
    });
});
