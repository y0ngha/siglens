/**
 * ISR empty-cache prevention tests for the /[symbol]/news page.
 *
 * A transient throw from getNewsList (Postgres), getEarningsReportComparison
 * (DB/FMP), or getGradeEvents (FMP) during ISR cold-gen must NOT propagate.
 * The page must degrade gracefully (non-empty result) rather than freezing
 * an empty ISR cache.
 *
 * Strategy: render the async section RSCs directly (await the section fn →
 * render the returned element) so their degraded output lands in the DOM.
 * Rendering the whole NewsPage wraps sections in <Suspense>, which
 * @testing-library/react does not flush — so degrade text never appears.
 * Page-level chrome assertions (h1 heading) keep a NewsPage render for the
 * two tests that need it.
 */

// vi.mock calls are hoisted above imports by vitest.
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: vi.fn(),
}));

// staticSymbolCache: call fetcher() directly so tests stay pure (no I/O).
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

// newsData functions — configured per-test to reject or resolve.
vi.mock('@/app/[locale]/[symbol]/news/newsData', () => ({
    getEarningsReportComparison: vi.fn(),
    getGradeEvents: vi.fn(),
}));

vi.mock('@/entities/news-article', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn(),
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
vi.mock('@/widgets/news/sections/NewsList', () => ({
    NewsList: ({ items }: { items: { id: string }[] }) => (
        <ul
            data-testid="news-list"
            data-count={items.length}
            data-first={items[0]?.id}
            data-last={items[items.length - 1]?.id}
        />
    ),
}));
vi.mock('@/widgets/news/sections/EventCalendar', () => ({
    EventCalendar: () => <div data-testid="event-calendar" />,
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    // data-count/first/last: 직렬화 상한이 몇 개를, 어느 쪽 끝에서 남기는지 관찰한다.
    AnalystActions: ({ events }: { events: { date: string }[] }) => (
        <div
            data-testid="analyst-actions"
            data-count={events.length}
            data-first={events[0]?.date}
            data-last={events[events.length - 1]?.date}
        />
    ),
}));
vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) => (
        <h1>{children}</h1>
    ),
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/views/symbol/SectionSkeleton', () => ({
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
    getFmpUserFacingMessage: vi.fn(),
}));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import NewsPage, {
    NewsListSection,
    EventCalendarSection,
    AnalystActionsSection,
} from '@/app/[locale]/[symbol]/news/page';
import { getAssetInfoResilient } from '@/entities/ticker';
import { getNewsList } from '@/entities/news-article/api';
import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[locale]/[symbol]/news/newsData';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/news/constants';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetNewsList = getNewsList as MockedFunction<typeof getNewsList>;
const mockGetEarningsReportComparison =
    getEarningsReportComparison as MockedFunction<
        typeof getEarningsReportComparison
    >;
const mockGetGradeEvents = getGradeEvents as MockedFunction<
    typeof getGradeEvents
>;
const mockGetFmpUserFacingMessage = getFmpUserFacingMessage as MockedFunction<
    typeof getFmpUserFacingMessage
>;

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

describe('/[symbol]/news ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(EQUITY_ASSET_INFO);
        // Default: sections succeed with empty data.
        mockGetNewsList.mockResolvedValue(
            [] as Awaited<ReturnType<typeof getNewsList>>
        );
        mockGetEarningsReportComparison.mockResolvedValue([]);
        mockGetGradeEvents.mockResolvedValue([]);
        // Default: non-FMP error (message = null) to trigger generic fallback path.
        mockGetFmpUserFacingMessage.mockReturnValue(null);
    });

    it('getNewsList throw → NewsListSection degrades to empty list, no throw', async () => {
        // Simulate transient DB failure during ISR cold-gen.
        mockGetNewsList.mockRejectedValue(new Error('DB connection refused'));

        // Render the section directly — its .catch(() => []) must absorb the throw.
        render(await NewsListSection({ symbol: 'AAPL' }));

        // NewsList stub renders with count 0 (degrade to []).
        const newsList = screen.getByTestId('news-list');
        expect(newsList).toBeInTheDocument();
        expect(newsList.getAttribute('data-count')).toBe('0');
    });

    it('getNewsList throw → page heading still renders (chrome intact)', async () => {
        mockGetNewsList.mockRejectedValue(new Error('DB connection refused'));

        // The page-level chrome (heading) lives outside Suspense — render the
        // full page to verify the heading is present even when the section degrades.
        render(
            await NewsPage({
                params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
            })
        );

        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('getEarningsReportComparison throw (non-FMP) → EventCalendarSection renders generic alert, no throw', async () => {
        // non-FMP error: getFmpUserFacingMessage returns null → generic fallback
        mockGetEarningsReportComparison.mockRejectedValue(
            new Error('DB connection refused')
        );
        mockGetFmpUserFacingMessage.mockReturnValue(null);
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        // Render the section directly — must not throw, must show generic message.
        render(await EventCalendarSection({ symbol: 'AAPL' }));

        expect(
            screen.getByText('실적 일정을 불러오지 못했어요.')
        ).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[EventCalendarSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('getEarningsReportComparison throw (FMP error) → EventCalendarSection renders FMP message, no throw', async () => {
        // FMP error: getFmpUserFacingMessage returns a user-facing string.
        mockGetEarningsReportComparison.mockRejectedValue(
            new Error('FMP API rate limit')
        );
        mockGetFmpUserFacingMessage.mockReturnValue(
            'FMP 서비스가 일시 중단됐어요.'
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await EventCalendarSection({ symbol: 'AAPL' }));

        expect(
            screen.getByText('FMP 서비스가 일시 중단됐어요.')
        ).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[EventCalendarSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('getGradeEvents throw (non-FMP) → AnalystActionsSection renders generic alert, no throw', async () => {
        // non-FMP error: getFmpUserFacingMessage returns null → generic fallback
        mockGetGradeEvents.mockRejectedValue(new Error('Redis unavailable'));
        mockGetFmpUserFacingMessage.mockReturnValue(null);
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        // Render the section directly — must not throw, must show generic message.
        render(await AnalystActionsSection({ symbol: 'AAPL' }));

        expect(
            screen.getByText('애널리스트 동향을 불러오지 못했어요.')
        ).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[AnalystActionsSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('getGradeEvents throw (FMP error) → AnalystActionsSection renders FMP message, no throw', async () => {
        mockGetGradeEvents.mockRejectedValue(new Error('FMP error'));
        mockGetFmpUserFacingMessage.mockReturnValue(
            '데이터 제공 서비스에 문제가 생겼어요.'
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(await AnalystActionsSection({ symbol: 'AAPL' }));

        expect(
            screen.getByText('데이터 제공 서비스에 문제가 생겼어요.')
        ).toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[AnalystActionsSection]'),
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });

    it('success path — all loaders succeed → real content rendered, no degrade alerts', async () => {
        // All loaders succeed with empty-but-valid data.
        mockGetNewsList.mockResolvedValue(
            [] as Awaited<ReturnType<typeof getNewsList>>
        );
        mockGetEarningsReportComparison.mockResolvedValue([]);
        mockGetGradeEvents.mockResolvedValue([]);

        // Each section renders its real stub content when loaders succeed.
        render(await NewsListSection({ symbol: 'AAPL' }));
        expect(screen.getByTestId('news-list')).toBeInTheDocument();
        expect(
            screen.queryByText('실적 일정을 불러오지 못했어요.')
        ).not.toBeInTheDocument();

        render(await EventCalendarSection({ symbol: 'AAPL' }));
        expect(screen.getByTestId('event-calendar')).toBeInTheDocument();
        expect(
            screen.queryByText('실적 일정을 불러오지 못했어요.')
        ).not.toBeInTheDocument();

        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        expect(screen.getByTestId('analyst-actions')).toBeInTheDocument();
        expect(
            screen.queryByText('애널리스트 동향을 불러오지 못했어요.')
        ).not.toBeInTheDocument();
    });
});

/**
 * 클라이언트로 **직렬화해 보내는 행 수**의 상한을 고정한다.
 *
 * 이 상한이 없으면 화면에 5개만 그리면서 1,400~1,800행을 RSC 페이로드에 실어 보낸다.
 * 반대로 상한을 잘못 걸면(뒤에서 자르기, 정렬 전 자르기) **최신 기사가 사라지고 가장
 * 오래된 것만 남는데 렌더는 멀쩡해서 아무도 눈치채지 못한다** — 그래서 개수만이 아니라
 * 어느 쪽 끝이 남는지까지 단언한다.
 */
describe('/[symbol]/news 직렬화 행 상한', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'AAPL', name: 'Apple Inc.' },
            degraded: false,
        } as unknown as Awaited<ReturnType<typeof getAssetInfoResilient>>);
    });

    /**
     * 최신순(내림차순) 뉴스 n건 — 앞이 최신이다. 상한이 개수와 방향을 지키는지만
     * 보므로 `NewsList` 스텁이 읽는 `id` 외 필드는 채우지 않는다.
     */
    function newsRows(n: number) {
        return Array.from({ length: n }, (_, i) => ({
            id: `n${i}`,
            publishedAt: new Date(Date.UTC(2026, 0, 1) - i * 86_400_000),
        })) as unknown as Awaited<ReturnType<typeof getNewsList>>;
    }

    /** 최신순 등급 이벤트 n건 — `date` 내림차순. */
    function gradeRows(n: number) {
        return Array.from({ length: n }, (_, i) => ({
            symbol: 'AAPL',
            date: `2026-01-${String(n - i).padStart(2, '0')}`,
        })) as unknown as Awaited<ReturnType<typeof getGradeEvents>>;
    }

    it('상한을 넘으면 상한만큼만 넘긴다 (뉴스)', async () => {
        mockGetNewsList.mockResolvedValue(
            newsRows(NEWS_ROW_SERIALIZATION_LIMIT + 7)
        );
        render(await NewsListSection({ symbol: 'AAPL' }));
        expect(screen.getByTestId('news-list').getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
    });

    it('정확히 상한이면 하나도 잘리지 않는다 — off-by-one 감지', async () => {
        mockGetNewsList.mockResolvedValue(
            newsRows(NEWS_ROW_SERIALIZATION_LIMIT)
        );
        render(await NewsListSection({ symbol: 'AAPL' }));
        expect(screen.getByTestId('news-list').getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
    });

    it('남기는 쪽은 앞(최신)이다 — 뒤에서 자르는 뮤테이션 감지', async () => {
        mockGetNewsList.mockResolvedValue(
            newsRows(NEWS_ROW_SERIALIZATION_LIMIT + 7)
        );
        render(await NewsListSection({ symbol: 'AAPL' }));
        const el = screen.getByTestId('news-list');
        expect(el.getAttribute('data-first')).toBe('n0');
        expect(el.getAttribute('data-last')).toBe(
            `n${NEWS_ROW_SERIALIZATION_LIMIT - 1}`
        );
    });

    it('등급 이벤트에도 같은 상한이 걸린다 — 한쪽에만 거는 실수 감지', async () => {
        mockGetGradeEvents.mockResolvedValue(
            gradeRows(NEWS_ROW_SERIALIZATION_LIMIT + 7)
        );
        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        const el = screen.getByTestId('analyst-actions');
        expect(el.getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
        // 앞이 최신이어야 한다(getGrades가 date 내림차순을 보장한다는 전제).
        expect(el.getAttribute('data-first')).toBe(
            `2026-01-${String(NEWS_ROW_SERIALIZATION_LIMIT + 7).padStart(2, '0')}`
        );
    });
});
