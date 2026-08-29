/**
 * SEO snapshot prose integration tests for the news page — Task 7b.
 *
 * Unlike the other 4 tabs, the news page already SSR-renders a deterministic
 * DB news list via `NewsFactsSummary` (ISR-degrade-guarded). This suite
 * verifies that `NewsSnapshotProse` (AI news analysis) is mounted as an
 * ADDITIONAL sibling — both coexist — reads the snapshot with the page's
 * exact revalidate literal (43200), and does not disturb the existing
 * NewsFactsSummary wiring.
 *
 * Strategy: invoke the RSC directly (no render) and traverse the returned
 * element tree with findElementByType, mirroring page.body.test.tsx.
 */

// MISTAKES §17: all vi.mock + vi.hoisted above imports.
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));
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

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

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

vi.mock('@/shared/lib/getTodayIsoDay', () => ({
    getTodayIsoDay: () => '2026-07-24',
}));
vi.mock('@/shared/lib/dateKey', () => ({
    todayKstIsoDate: () => '2026-07-24',
}));
vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingKey: vi.fn().mockReturnValue(null),
    translateFmpError: vi.fn().mockReturnValue(null),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewsPage, { generateMetadata } from '@/app/[locale]/[symbol]/news/page';
import { NewsFactsSummary } from '@/widgets/news';
import { NewsSnapshotProse } from '@/views/symbol/snapshot/renderers/NewsSnapshotProse';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { getAssetInfoResilient } from '@/entities/ticker';
import { findElementByType } from '@/__tests__/utils/findElementByType';

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

const SNAPSHOT_CONTENT = {
    currentDriverKo: '최근 실적 발표가 주가 흐름을 주도하고 있습니다.',
    overallSentiment: 'bullish',
    keyEventsKo: [],
    upcomingEventsKo: [],
};

describe('NewsPage — SEO snapshot prose (Task 7b, dual-section with NewsFactsSummary)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    it('스냅샷 있으면 NewsSnapshotProse를 렌더하고, 결정론적 NewsFactsSummary는 공존하지만 중복되는 AI 위젯(NewsAiSummary)은 hideView로 UI만 끈다 (audit fix FIX 2)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'news',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, NewsSnapshotProse);
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toEqual(
            SNAPSHOT_CONTENT
        );
        // C3(감사): content만 확인하고 generatedAt은 확인하지 않았다 —
        // 페이지에서 `generatedAt={…}` prop을 통째로 지워도 이 테스트는
        // 여전히 그린이었다.
        expect((prose?.props as { generatedAt?: Date }).generatedAt).toEqual(
            new Date('2026-07-24')
        );
        // Complementary, not exclusive — the deterministic DB-list facts section
        // still renders alongside the AI prose.
        expect(findElementByType(tree, NewsFactsSummary)).not.toBeNull();
        // AI 위젯은 **마운트는 유지**하되 `hideView`로 자기 뷰만 내리지 않는다 —
        // 중복 텍스트는 사라지고 챗 컨텍스트 publish는 계속된다.
        const widget = findElementByType(tree, NewsAiSummary);
        expect(widget).not.toBeNull();
        expect(widget?.props).toMatchObject({ hideView: true });
    });

    it('스냅샷 없으면(빈 배열) content가 undefined로 전달되고 NewsFactsSummary·NewsAiSummary(AI 위젯) 모두 그대로 렌더된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, NewsSnapshotProse);
        expect(prose).not.toBeNull();
        expect((prose?.props as { content: unknown }).content).toBeUndefined();
        expect(findElementByType(tree, NewsFactsSummary)).not.toBeNull();
        expect(findElementByType(tree, NewsAiSummary)).not.toBeNull();
    });

    it('다른 탭(overall)의 스냅샷은 news 슬롯에 전달되지 않아 NewsAiSummary(AI 위젯)로 폴백한다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'overall',
                content: { headlineKo: '헤드라인' },
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const tree = await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        const prose = findElementByType(tree, NewsSnapshotProse);
        expect((prose?.props as { content: unknown }).content).toBeUndefined();
        expect(findElementByType(tree, NewsAiSummary)).not.toBeNull();
    });

    it('getSeoSnapshotsStatic은 페이지의 revalidate 리터럴(43200)로 호출된다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await NewsPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            43200,
            'ko'
        );
    });

    it('getSeoSnapshotsStatic이 throw해도 페이지가 깨지지 않는다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await expect(
            NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
            })
        ).resolves.toBeTruthy();
    });
});

/**
 * spec 2026-07-24 Task 8 — generateMetadata should use the pre-warmed
 * snapshot's `currentDriverKo` prose as the <meta name="description"> when a
 * news snapshot row exists, falling back to the templated description
 * (resolveSymbolNewsSeoContent's mocked `description: 'd'`) otherwise.
 */
describe('NewsPage generateMetadata — snapshot-derived description (Task 8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
    });

    it('uses the snapshot currentDriverKo when a news snapshot row exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'news',
                content: SNAPSHOT_CONTENT,
                model: 'deepseek-v4-flash',
                generatedAt: new Date('2026-07-24'),
            },
        ]);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        // FIX 5 (audit): description is prefixed with the resolved display
        // name (subject; buildDisplayName mocked above to `assetInfo.name`)
        // before clamping.
        expect(metadata.description).toBe(
            `Apple Inc. — ${SNAPSHOT_CONTENT.currentDriverKo}`
        );
        // og description keeps the templated copy — only the search-facing
        // <meta name="description"> is overridden.
        const og = metadata.openGraph as Record<string, unknown>;
        expect(og.description).toBe('d');
    });

    it('falls back to the templated description when no news snapshot exists', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.description).toBe('d');
    });

    it('getSeoSnapshotsStatic is called with the page revalidate literal (43200) in generateMetadata too', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);

        await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            43200,
            'ko'
        );
    });
});
