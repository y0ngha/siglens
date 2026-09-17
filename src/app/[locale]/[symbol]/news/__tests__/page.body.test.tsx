/**
 * News page body section-gating tests — verifies isEquity branching hides
 * EventCalendarSection + AnalystActionsSection for crypto and shows them for
 * equity. These are the sections introduced in Phase 2 (crypto branch) that
 * were NOT covered by the existing page.test.ts (which only checks revalidate).
 *
 * Strategy: invoke the RSC directly (no DOM render) and traverse the returned
 * element tree with findElementByType, mirroring page.factlayer.test.tsx.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
    getAssetInfoResilient: vi.fn(),
}));

// staticSymbolCache wraps unstable_cache — bypass I/O entirely and call
// fetcher() directly so the test stays pure and fast.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

// newsData functions return empty arrays — we only care about section presence
vi.mock('@/app/[locale]/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: vi.fn().mockResolvedValue([]),
    getGradeEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/entities/news-article', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/widgets/news/NewsAiSummary', () => ({
    NewsAiSummary: () => null,
}));
vi.mock('@/widgets/news/NewsAiSummaryErrorBoundary', () => ({
    NewsAiSummaryErrorBoundary: ({ children }: { children: unknown }) =>
        children,
}));
vi.mock('@/widgets/news/NewsAiSummarySkeleton', () => ({
    NewsAiSummarySkeleton: () => null,
}));
vi.mock('@/widgets/news', () => ({
    NewsFactsSummary: () => null,
}));
vi.mock('@/widgets/news/sections/NewsList', () => ({
    NewsList: () => null,
}));
vi.mock('@/widgets/news/sections/EventCalendar', () => ({
    EventCalendar: () => null,
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    AnalystActions: () => null,
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/views/symbol/SectionSkeleton', () => ({
    SectionSkeleton: () => null,
}));

vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | Siglens',
        description: 'd',
        url: 'https://siglens.io/AAPL',
        keywords: [],
    }),
    resolveSymbolNewsSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | Siglens',
        description: 'd',
        url: 'https://siglens.io/AAPL',
        keywords: [],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: () => '2026-06-22',
}));
vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingKey: vi.fn().mockReturnValue(null),
    translateFmpError: vi.fn().mockReturnValue(null),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, isValidElement, type ReactNode } from 'react';
import NewsPage from '@/app/[locale]/[symbol]/news/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getNewsList } from '@/entities/news-article/api';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { NewsFactsSummary } from '@/widgets/news';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { expectSymbolBreadcrumbName } from '@/__tests__/utils/expectSymbolBreadcrumbName';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { ORGANIZATION_JSON_LD_ID } from '@/shared/lib/seo';
import type { NewsDisplayItem } from '@/shared/lib/types';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);
const mockGetNewsList = vi.mocked(getNewsList);

/**
 * Collect all Suspense children ReactNodes from the element tree.
 *
 * EventCalendarSection and AnalystActionsSection are local async RSC functions
 * defined in page.tsx. When the page is invoked in a test (not rendered), they
 * appear as JSX elements whose `type` is the local function. Since we can't
 * import those local functions, we instead collect the *children* of every
 * Suspense in the tree and check the function names via `.type.name`.
 *
 * The inner traversal is extracted as `walkSuspense` (module-level, explicit
 * `results` parameter) to avoid a nested closure that captures the outer array
 * implicitly — see MISTAKES §20.
 */
function walkSuspense(node: ReactNode, results: ReactNode[]): void {
    if (Array.isArray(node)) {
        node.forEach(n => walkSuspense(n, results));
        return;
    }
    if (!isValidElement(node)) return;
    if (node.type === Suspense) {
        const children = (node.props as { children?: ReactNode }).children;
        if (children !== undefined) results.push(children);
    }
    const childProp = (node.props as { children?: ReactNode }).children;
    if (childProp) walkSuspense(childProp, results);
}

function findAllSuspenseChildren(tree: ReactNode): ReactNode[] {
    const results: ReactNode[] = [];
    walkSuspense(tree, results);
    return results;
}

/**
 * Find an element whose type name matches `fnName` in the Suspense children
 * collected from the tree. Works for local async RSC functions that can't be
 * imported from the outside.
 */
function findSuspenseChildByName(tree: ReactNode, fnName: string): boolean {
    return findAllSuspenseChildren(tree).some(child => {
        if (!isValidElement(child)) return false;
        const t = child.type as { name?: string } | string;
        return (
            typeof t === 'function' && (t as { name?: string }).name === fnName
        );
    });
}

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

const READY_NEWS: Awaited<ReturnType<typeof getNewsList>> = [
    {
        id: 'news-1',
        publishedAt: '2026-05-06T00:00:00.000Z',
        titleEn: 'Apple announces new product',
        titleKo: '애플, 신제품 발표',
        sentiment: 'bullish',
        category: 'earnings',
        bodyKo: '애플은 신제품 발표 이후 수요 기대가 커졌다고 밝혔습니다.',
        summaryKo: '신제품 발표가 투자심리에 긍정적으로 작용했습니다.',
        priceImpact: 'medium',
        url: 'https://example.com/news-1',
        source: 'Example',
    },
];

describe('NewsPage — NewsFactsSummary SSR props', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetNewsList.mockResolvedValue([]);
    });

    it('equity page passes displayName, assetClass, and fetched news items', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetNewsList.mockResolvedValue(READY_NEWS);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const facts = findElementByType(tree, NewsFactsSummary);

        expect(facts).not.toBeNull();
        expect(facts?.props).toMatchObject({
            // `symbol` prop은 제거했다 — `displayName`이 이미 티커를 품어
            // `Apple Inc. (AAPL) (AAPL)`로 두 번 렌더됐다.
            displayName: 'Apple Inc.',
            assetClass: 'equity',
            items: READY_NEWS,
        });
    });

    it('degraded news fetch passes an empty items array to NewsFactsSummary', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetNewsList.mockRejectedValueOnce(new Error('news fetch failed'));

        try {
            const tree = await NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            });

            const facts = findElementByType(tree, NewsFactsSummary);

            expect(facts).not.toBeNull();
            expect(
                (facts?.props as { items: NewsDisplayItem[] }).items
            ).toEqual([]);
        } finally {
            errorSpy.mockRestore();
        }
    });
});

describe('NewsPage — isEquity body section-gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetNewsList.mockResolvedValue([]);
    });

    it('equity symbol → EventCalendarSection present as Suspense child', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findSuspenseChildByName(tree, 'EventCalendarSection')).toBe(
            true
        );
    });

    it('equity symbol → AnalystActionsSection present as Suspense child', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findSuspenseChildByName(tree, 'AnalystActionsSection')).toBe(
            true
        );
    });

    it('crypto symbol → EventCalendarSection NOT present (hidden by isEquity gate)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        expect(findSuspenseChildByName(tree, 'EventCalendarSection')).toBe(
            false
        );
    });

    it('crypto symbol → AnalystActionsSection NOT present (hidden by isEquity gate)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        expect(findSuspenseChildByName(tree, 'AnalystActionsSection')).toBe(
            false
        );
    });

    it('crypto symbol → page heading uses crypto copy (최신 코인 뉴스)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('최신 코인 뉴스');
        expect(treeStr).not.toContain('최신 뉴스와 어닝 일정');
    });

    it('equity symbol → page heading uses equity copy (최신 뉴스와 어닝 일정)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('최신 뉴스와 어닝 일정');
        expect(treeStr).not.toContain('최신 코인 뉴스');
    });
});

describe('NewsPage — aiArticleJsonLd headline/description isEquity branch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetNewsList.mockResolvedValue([]);
        // Article JSON-LD는 화면에 보이는 AI 산문이 있을 때만 실린다(2026-09-17
        // 정책 감사 M5). headline 분기를 보려면 산문 스냅샷이 있어야 한다.
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            {
                tab: 'news',
                content: { currentDriverKo: '테스트용 뉴스 동인' },
                generatedAt: new Date('2026-09-01'),
            },
        ] as unknown as Awaited<ReturnType<typeof getSeoSnapshotsStatic>>);
    });

    it('crypto → aiArticleJsonLd headline uses 최근 코인 뉴스 AI 요약', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'BTCUSD' }),
        });

        const treeStr = JSON.stringify(tree);
        // crypto headline
        expect(treeStr).toContain('최근 코인 뉴스 AI 요약');
        // equity-only headline must be absent
        expect(treeStr).not.toContain('최근 뉴스 AI 요약\\"');
    });

    it('equity → aiArticleJsonLd headline uses 최근 뉴스 AI 요약 (not 코인)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const treeStr = JSON.stringify(tree);
        // equity headline (ends before 코인)
        expect(treeStr).toContain('최근 뉴스 AI 요약');
        // crypto-only headline must be absent
        expect(treeStr).not.toContain('최근 코인 뉴스 AI 요약');
    });
});

/**
 * 회귀 가드: `ItemList` 구조화데이터는 **초기 DOM에 실제로 그려지는 뉴스 수**를
 * 넘으면 안 된다. `NewsList`는 `NEWS_LIST_PAGE_SIZE`개만 그리고 나머지는 "더보기"
 * 클릭으로 클라이언트 상태에만 들어오는데, 구글은 버튼을 누르지 않는다. 예전에는
 * 페이지가 자체 상한(10)을 따로 들고 있어 마크업이 10건을 주장하면서 DOM에는
 * 5건만 있었다 — 리터럴이 두 벌이라 조용히 갈렸다.
 */
describe('NewsPage — ItemList 상한은 렌더 개수와 같은 상수를 쓴다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    it(`뉴스가 많아도 itemListElement는 NEWS_LIST_PAGE_SIZE(${NEWS_LIST_PAGE_SIZE})건이다`, async () => {
        const manyItems = Array.from(
            { length: NEWS_LIST_PAGE_SIZE * 3 },
            (_, i) => ({
                id: `news-${i}`,
                publishedAt: '2026-05-06T00:00:00.000Z',
                titleEn: `Headline ${i}`,
                titleKo: `헤드라인 ${i}`,
                sentiment: 'bullish',
                category: 'earnings',
                bodyKo: null,
                summaryKo: null,
                priceImpact: 'medium',
                url: `https://example.com/news-${i}`,
                source: 'Example',
            })
        ) as NewsDisplayItem[];
        mockGetNewsList.mockResolvedValue(manyItems);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const itemList = collectJsonLdData(tree).find(
            d => d['@type'] === 'ItemList'
        );
        expect(itemList).toBeDefined();
        expect(itemList?.itemListElement).toHaveLength(NEWS_LIST_PAGE_SIZE);
    });
});

describe('NewsPage — BreadcrumbList 이름', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetNewsList.mockResolvedValue([]);
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    /**
     * 회귀 가드: BreadcrumbList position 2는 화면 브레드크럼과 같은 이름이어야 한다.
     * 근거는 `expectSymbolBreadcrumbName` JSDoc 참고.
     */
    it('BreadcrumbList가 티커가 아니라 displayName을 쓴다', async () => {
        await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expectSymbolBreadcrumbName('Apple Inc.');
    });
});

/**
 * Article JSON-LD의 노출 조건과 `dateModified` 출처(2026-09-17 정책 감사 M2·M5).
 *
 * - 화면에 보이는 AI 산문이 없으면 Article 노드 자체를 싣지 않는다(마크업이
 *   페이지에 없는 콘텐츠를 주장하지 않는다).
 * - `dateModified`는 **이 페이지에 실제로 실린 것**의 시각이다. 예전에는
 *   `getTodayIsoDay()`(오늘 0시)라 전 종목이 매일 갱신된다고 주장했다.
 */
describe('NewsPage — Article JSON-LD 게이트와 dateModified', () => {
    const PROSE_SNAPSHOT = [
        {
            tab: 'news',
            content: { currentDriverKo: '실적 기대가 가격을 끌고 있다.' },
            generatedAt: new Date('2026-09-01T03:04:05.000Z'),
        },
    ] as unknown as Awaited<ReturnType<typeof getSeoSnapshotsStatic>>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetNewsList.mockResolvedValue([]);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([]);
    });

    const findArticle = (tree: ReactNode) =>
        collectJsonLdData(tree).find(d => d['@type'] === 'Article');

    it('산문이 없으면 Article 노드를 싣지 않는다', async () => {
        mockGetNewsList.mockResolvedValue(READY_NEWS);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findArticle(tree)).toBeUndefined();
    });

    it('산문이 있으면 최신 뉴스 발행 시각을 dateModified로 쓴다', async () => {
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue(PROSE_SNAPSHOT);
        mockGetNewsList.mockResolvedValue(READY_NEWS);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findArticle(tree)?.dateModified).toBe(READY_NEWS[0].publishedAt);
    });

    it('뉴스가 없으면 스냅샷 생성 시각으로 폴백한다', async () => {
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue(PROSE_SNAPSHOT);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(findArticle(tree)?.dateModified).toBe(
            '2026-09-01T03:04:05.000Z'
        );
    });

    it('WebPage 노드는 산문이 있을 때만 dateModified를 주장하고, publisher는 항상 @id 참조다', async () => {
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue(PROSE_SNAPSHOT);

        // 이 파일은 `buildWebPageJsonLd`를 `{}`로 스텁하므로 `@type`이 없다 —
        // `buildSymbolWebPageJsonLd`가 얹는 `publisher`로 그 노드를 집는다.
        const findWebPage = (tree: ReactNode) =>
            collectJsonLdData(tree).find(d => 'publisher' in d);

        const withProse = findWebPage(
            await NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );
        expect(withProse?.dateModified).toBe('2026-09-01T03:04:05.000Z');
        expect(withProse?.publisher).toEqual({
            '@type': 'Organization',
            '@id': ORGANIZATION_JSON_LD_ID,
        });

        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([]);
        const withoutProse = findWebPage(
            await NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        );
        expect(withoutProse).toBeDefined();
        expect('dateModified' in withoutProse!).toBe(false);
    });
});

/**
 * 크롤러 전용 `sr-only` 개요 제거(2026-09-17 정책 감사 M3 — Google "숨겨진 텍스트").
 * 같은 사실은 `NewsFactsSummary`가 화면에 보이는 텍스트로 이미 말한다.
 */
describe('NewsPage — sr-only 개요 부재', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        mockGetNewsList.mockResolvedValue([]);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([]);
    });

    it('sr-only 섹션을 렌더하지 않는다', async () => {
        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(JSON.stringify(tree)).not.toContain('sr-only');
    });
});
