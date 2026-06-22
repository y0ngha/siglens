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
vi.mock('@/app/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: vi.fn().mockResolvedValue([]),
    getGradeEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/entities/news-article', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
    NEWS_LIST_CACHE_KEY: 'news-list',
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
vi.mock('@/widgets/news/sections/NewsList', () => ({
    NewsList: () => null,
}));
vi.mock('@/widgets/news/sections/EventCalendar', () => ({
    EventCalendar: () => null,
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    AnalystActions: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
    SymbolPageHeading: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/widgets/symbol-page/SectionSkeleton', () => ({
    SectionSkeleton: () => null,
}));

vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
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

vi.mock('@/shared/lib/getTodayIsoDay', () => ({
    getTodayIsoDay: () => '2026-06-22',
}));
vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: () => '2026-06-22',
}));
vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingMessage: vi.fn().mockReturnValue(null),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, isValidElement, type ReactNode } from 'react';
import NewsPage from '@/app/[symbol]/news/page';
import { getAssetInfoResilient } from '@/entities/ticker';

const mockGetAssetInfoResilient = vi.mocked(getAssetInfoResilient);

/**
 * Collect all Suspense children ReactNodes from the element tree.
 *
 * EventCalendarSection and AnalystActionsSection are local async RSC functions
 * defined in page.tsx. When the page is invoked in a test (not rendered), they
 * appear as JSX elements whose `type` is the local function. Since we can't
 * import those local functions, we instead collect the *children* of every
 * Suspense in the tree and check the function names via `.type.name`.
 */
function findAllSuspenseChildren(tree: ReactNode): ReactNode[] {
    const results: ReactNode[] = [];
    function walk(node: ReactNode): void {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (!isValidElement(node)) return;
        if (node.type === Suspense) {
            const children = (node.props as { children?: ReactNode }).children;
            if (children !== undefined) results.push(children);
        }
        const childProp = (node.props as { children?: ReactNode }).children;
        if (childProp) walk(childProp);
    }
    walk(tree);
    return results;
}

/**
 * Find an element whose type name matches `fnName` in the Suspense children
 * collected from the tree. Works for local async RSC functions that can't be
 * imported from the outside.
 */
function findSuspenseChildByName(tree: ReactNode, fnName: string): boolean {
    const children = findAllSuspenseChildren(tree);
    for (const child of children) {
        if (isValidElement(child)) {
            const t = child.type as { name?: string } | string;
            if (
                typeof t === 'function' &&
                (t as { name?: string }).name === fnName
            ) {
                return true;
            }
        }
    }
    return false;
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
} as never;

const CRYPTO_ASSET_INFO = {
    assetInfo: {
        symbol: 'BTCUSD',
        name: 'Bitcoin',
        koreanName: '비트코인',
        fmpSymbol: null,
        marketProfile: 'crypto' as const,
    },
    degraded: false,
} as never;

describe('NewsPage — isEquity body section-gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('equity symbol → EventCalendarSection present as Suspense child', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findSuspenseChildByName(tree, 'EventCalendarSection')).toBe(
            true
        );
    });

    it('equity symbol → AnalystActionsSection present as Suspense child', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        expect(findSuspenseChildByName(tree, 'AnalystActionsSection')).toBe(
            true
        );
    });

    it('crypto symbol → EventCalendarSection NOT present (hidden by isEquity gate)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(findSuspenseChildByName(tree, 'EventCalendarSection')).toBe(
            false
        );
    });

    it('crypto symbol → AnalystActionsSection NOT present (hidden by isEquity gate)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        expect(findSuspenseChildByName(tree, 'AnalystActionsSection')).toBe(
            false
        );
    });

    it('crypto symbol → page heading uses crypto copy (최신 코인 뉴스)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(CRYPTO_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'BTCUSD' }),
        });

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('최신 코인 뉴스');
        expect(treeStr).not.toContain('최신 뉴스와 어닝 일정');
    });

    it('equity symbol → page heading uses equity copy (최신 뉴스와 어닝 일정)', async () => {
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);

        const tree = await NewsPage({
            params: Promise.resolve({ symbol: 'aapl' }),
        });

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('최신 뉴스와 어닝 일정');
        expect(treeStr).not.toContain('최신 코인 뉴스');
    });
});
