/**
 * 뉴스 탭이 실적 캘린더 섹션에 넘기는 `today`가 요청 시각의 **KST** 날짜 키인지 고정한다 — 캐시 키에
 * 들어가 날이 바뀌면 "다음 실적" 비교가 다시 계산되므로, UTC 날짜로 새면 KST 자정~09시에 하루 묵는다.
 */
// TESTING.md#TE-1: all vi.mock + vi.hoisted above imports.
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn((assetInfo: { name: string }) => assetInfo.name),
}));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
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

vi.mock('@/entities/news-article/lib/cacheKeys', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/entities/seo-snapshot/server/getSnapshotStatic', () => ({
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
vi.mock('@/widgets/news/NewsFactsSummary', () => ({
    NewsFactsSummary: () => null,
}));
vi.mock('@/widgets/news/sections/NewsList', () => ({
    NewsList: () => null,
}));
vi.mock('@/widgets/news/sections/EventCalendar', () => ({
    EventCalendar: () => null,
}));
vi.mock('@/entities/company-filings/server/getCompanyFilings', () => ({
    // 기본은 SEC 공시 대상이 아님 — 섹션을 그리지 않는다. DB·SEC에 나가지 않는다.
    listCompanyFilings: vi.fn(async () => ({ status: 'no_sec_filer' })),
}));
vi.mock('@/entities/analyst-views/server/getAnalystActionHistory', () => ({
    // 기본은 "Yahoo 이력 없음"(한국 종목·E2E와 같은 경로) — 기존 등급 목록으로 그린다. 네트워크에 나가지 않는다.
    getAnalystActionHistory: vi.fn(async () => null),
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    AnalystActions: () => null,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
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
        fullTitle: 'T | SIGLENS',
        description: 'd',
        url: 'https://siglens.io/AAPL',
        keywords: [],
    }),
    resolveSymbolNewsSeoContent: vi.fn().mockReturnValue({
        title: 'T',
        fullTitle: 'T | SIGLENS',
        description: 'd',
        url: 'https://siglens.io/AAPL',
        keywords: [],
    }),
    SITE_URL: 'https://siglens.io',
}));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingKey: vi.fn().mockReturnValue(null),
    translateFmpError: vi.fn().mockReturnValue(null),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findElementByType } from '@/__tests__/utils/findElementByType';
import { EventCalendarSection } from '@/app/[locale]/[symbol]/news/_components/NewsSections';
import NewsPage from '@/app/[locale]/[symbol]/news/page';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';

describe('NewsPage — 실적 캘린더 today', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.mocked(getAssetInfoResilient).mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                koreanName: '애플',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        // UTC 자정 직후 — KST로는 같은 날 오전, 미국 동부(EDT)는 아직 전날 저녁이다.
        ['2026-10-29T00:05:00.000Z', '2026-10-29', '2026-10-28'],
        // KST 자정 직전 — UTC·KST·ET 모두 10-29.
        ['2026-10-29T14:59:00.000Z', '2026-10-29', '2026-10-29'],
        // KST 자정 직후 — UTC·ET로는 아직 10-29지만 KST는 다음 날이다.
        ['2026-10-29T15:01:00.000Z', '2026-10-30', '2026-10-29'],
    ])(
        '요청 시각 %s → today=%s(KST), marketToday=%s(미국 종목은 ET)',
        async (now, expected, expectedMarket) => {
            vi.setSystemTime(new Date(now));

            const tree = await NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
            });

            const section = findElementByType(tree, EventCalendarSection);
            const props = section?.props as
                | { today?: string; marketToday?: string }
                | undefined;
            expect(props?.today).toBe(expected);
            expect(props?.marketToday).toBe(expectedMarket);
        }
    );
});
