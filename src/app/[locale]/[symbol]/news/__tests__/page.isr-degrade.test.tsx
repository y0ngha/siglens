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

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string; koreanName?: string }) =>
        info.koreanName ?? info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
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

vi.mock('@/entities/news-article/lib/cacheKeys', () => ({
    NEWS_LIST_CACHE_KEY: 'news-list',
}));
vi.mock('@/entities/news-article/api', () => ({
    getNewsList: vi.fn(),
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
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: vi.fn(async () => undefined),
}));
vi.mock('@/entities/company-filings/server/getCompanyFilings', () => ({
    // 기본은 SEC 공시 대상이 아님 — 섹션을 그리지 않는다. DB·SEC에 나가지 않는다.
    listCompanyFilings: vi.fn(async () => ({ status: 'no_sec_filer' })),
}));
vi.mock('@/entities/analyst-views/server/getAnalystActionHistory', () => ({
    // 기본은 "Yahoo 이력 없음"(한국 종목·E2E와 같은 경로) — 기존 등급 목록으로 그린다. 네트워크에 나가지 않는다.
    getAnalystActionHistory: vi.fn(async () => null),
}));
vi.mock('@/widgets/news/sections/CompanyFilings', () => ({
    CompanyFilings: ({ filings }: { filings: { accession: string }[] }) => (
        <div data-testid="company-filings" data-count={filings.length} />
    ),
}));
vi.mock('@/widgets/news/sections/AnalystActions', () => ({
    // data-count/first/last: 직렬화 상한이 몇 개를, 어느 쪽 끝에서 남기는지 관찰한다.
    AnalystActions: ({ items }: { items: { date: string }[] }) => (
        <div
            data-testid="analyst-actions"
            data-count={items.length}
            data-first={items[0]?.date}
            data-last={items[items.length - 1]?.date}
        />
    ),
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
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
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/lib/seoSymbol', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seoSymbol')>()),
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
}));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpUserFacingKey: vi.fn(),
    translateFmpError: vi.fn().mockReturnValue(null),
}));

import React from 'react';
import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import NewsPage from '@/app/[locale]/[symbol]/news/page';
import {
    NewsListSection,
    EventCalendarSection,
    AnalystActionsSection,
    CompanyFilingsSection,
} from '@/app/[locale]/[symbol]/news/_components/NewsSections';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { getNewsList } from '@/entities/news-article/api';
import { getAnalystActionHistory } from '@/entities/analyst-views/server/getAnalystActionHistory';
import { listCompanyFilings } from '@/entities/company-filings/server/getCompanyFilings';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[locale]/[symbol]/news/newsData';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

const mockGetAssetInfoResilient = getAssetInfoResilient as MockedFunction<
    typeof getAssetInfoResilient
>;
const mockGetNewsList = getNewsList as MockedFunction<typeof getNewsList>;
const mockGetEarningsReportComparison =
    getEarningsReportComparison as MockedFunction<
        typeof getEarningsReportComparison
    >;
const mockShortenRevalidate =
    shortenRevalidateForRuntimeDegrade as MockedFunction<
        typeof shortenRevalidateForRuntimeDegrade
    >;
const mockListCompanyFilings = listCompanyFilings as MockedFunction<
    typeof listCompanyFilings
>;
const mockGetAnalystActionHistory = getAnalystActionHistory as MockedFunction<
    typeof getAnalystActionHistory
>;
const mockGetGradeEvents = getGradeEvents as MockedFunction<
    typeof getGradeEvents
>;
// 페이지가 실제로 부르는 건 `translateFmpError`다(키를 번역해 문구로 만든다).
const mockGetFmpUserFacingMessage = translateFmpError as MockedFunction<
    typeof translateFmpError
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
        render(await NewsListSection({ symbol: 'AAPL', locale: 'ko' }));

        // NewsList stub renders with count 0 (degrade to []).
        const newsList = screen.getByTestId('news-list');
        expect(newsList).toBeInTheDocument();
        expect(newsList.getAttribute('data-count')).toBe('0');
    });

    it('getNewsList throw → page heading still renders (chrome intact)', async () => {
        mockGetNewsList.mockRejectedValue(new Error('DB connection refused'));

        // 서버 섹션은 더는 Suspense로 감싸지 않아 트리에 async 서버 컴포넌트가 그대로 있다.
        // 클라이언트 `render()`는 그걸 못 돌리므로, 트리의 async 컴포넌트를 먼저 풀어 전체
        // 페이지를 렌더한다 — 섹션이 degrade해도 헤딩(크롬)이 남아야 한다.
        render(
            await resolveAsyncServerTree(
                await NewsPage({
                    params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
                })
            )
        );

        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('getEarningsReportComparison throw (non-FMP) → EventCalendarSection renders generic alert, no throw', async () => {
        // non-FMP error: getFmpUserFacingKey returns null → generic fallback
        mockGetEarningsReportComparison.mockRejectedValue(
            new Error('DB connection refused')
        );
        mockGetFmpUserFacingMessage.mockReturnValue(null);
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        // Render the section directly — must not throw, must show generic message.
        render(
            await EventCalendarSection({ symbol: 'AAPL', today: '2026-10-29' })
        );

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
        // FMP error: getFmpUserFacingKey returns a user-facing string.
        mockGetEarningsReportComparison.mockRejectedValue(
            new Error('FMP API rate limit')
        );
        mockGetFmpUserFacingMessage.mockReturnValue(
            'FMP 서비스가 일시 중단됐어요.'
        );
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        render(
            await EventCalendarSection({ symbol: 'AAPL', today: '2026-10-29' })
        );

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
        // non-FMP error: getFmpUserFacingKey returns null → generic fallback
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
        render(await NewsListSection({ symbol: 'AAPL', locale: 'ko' }));
        expect(screen.getByTestId('news-list')).toBeInTheDocument();
        expect(
            screen.queryByText('실적 일정을 불러오지 못했어요.')
        ).not.toBeInTheDocument();

        render(
            await EventCalendarSection({ symbol: 'AAPL', today: '2026-10-29' })
        );
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
/** `n`이 클수록 최근인 날짜(오늘 기준 100−n일 전) — 끊긴 이력 규칙(180일)에 걸리지 않는다. */
function recentDay(n: number): string {
    return new Date(Date.now() - (100 - n) * 86_400_000)
        .toISOString()
        .slice(0, 10);
}

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
        render(await NewsListSection({ symbol: 'AAPL', locale: 'ko' }));
        expect(screen.getByTestId('news-list').getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
    });

    it('정확히 상한이면 하나도 잘리지 않는다 — off-by-one 감지', async () => {
        mockGetNewsList.mockResolvedValue(
            newsRows(NEWS_ROW_SERIALIZATION_LIMIT)
        );
        render(await NewsListSection({ symbol: 'AAPL', locale: 'ko' }));
        expect(screen.getByTestId('news-list').getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
    });

    it('남기는 쪽은 앞(최신)이다 — 뒤에서 자르는 뮤테이션 감지', async () => {
        mockGetNewsList.mockResolvedValue(
            newsRows(NEWS_ROW_SERIALIZATION_LIMIT + 7)
        );
        render(await NewsListSection({ symbol: 'AAPL', locale: 'ko' }));
        const el = screen.getByTestId('news-list');
        expect(el.getAttribute('data-first')).toBe('n0');
        expect(el.getAttribute('data-last')).toBe(
            `n${NEWS_ROW_SERIALIZATION_LIMIT - 1}`
        );
    });

    it('Yahoo 이력(목표가 포함)이 있으면 그것으로 그리고 같은 상한을 건다 — 등급 이벤트는 읽지 않는다', async () => {
        mockGetAnalystActionHistory.mockResolvedValueOnce(
            Array.from(
                { length: NEWS_ROW_SERIALIZATION_LIMIT + 3 },
                (_, i) => ({
                    date: recentDay(NEWS_ROW_SERIALIZATION_LIMIT + 3 - i),
                    firm: `Firm ${i}`,
                    action: 'maintain' as const,
                    fromGrade: 'Buy',
                    toGrade: 'Buy',
                    priorTarget: 100,
                    target: 110,
                    targetAction: 'raise' as const,
                })
            )
        );
        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        const el = screen.getByTestId('analyst-actions');
        expect(el.getAttribute('data-count')).toBe(
            String(NEWS_ROW_SERIALIZATION_LIMIT)
        );
        expect(el.getAttribute('data-first')).toBe(
            recentDay(NEWS_ROW_SERIALIZATION_LIMIT + 3)
        );
        expect(mockGetGradeEvents).not.toHaveBeenCalled();
    });

    it('Yahoo 이력의 최신 행이 180일보다 오래됐으면(끊긴 이력) 등급 이벤트로 그린다', async () => {
        mockGetGradeEvents.mockResolvedValue(gradeRows(2));
        mockGetAnalystActionHistory.mockResolvedValueOnce([
            {
                date: '2023-03-01',
                firm: 'Old Firm',
                action: 'maintain',
                fromGrade: 'Buy',
                toGrade: 'Buy',
                priorTarget: null,
                target: 10,
                targetAction: null,
            },
        ]);
        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        expect(
            screen.getByTestId('analyst-actions').getAttribute('data-count')
        ).toBe('2');
        expect(mockGetGradeEvents).toHaveBeenCalledTimes(1);
    });

    it('Yahoo 이력이 예산(2.5초) 안에 오지 않으면 등급 이벤트로 그리고 이번 렌더의 revalidate를 낮춘다', async () => {
        vi.useFakeTimers();
        try {
            mockGetGradeEvents.mockResolvedValue(gradeRows(1));
            mockGetAnalystActionHistory.mockReturnValueOnce(
                new Promise(() => {})
            );
            const pending = AnalystActionsSection({ symbol: 'AAPL' });
            await vi.advanceTimersByTimeAsync(2_500);
            render(await pending);
            expect(
                screen.getByTestId('analyst-actions').getAttribute('data-count')
            ).toBe('1');
            expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('Yahoo 이력이 실패하거나 비면 등급 이벤트로 그린다(보강 실패는 경고 카드가 아니다)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockGetGradeEvents.mockResolvedValue(gradeRows(3));
        mockGetAnalystActionHistory.mockRejectedValueOnce(
            new Error('yahoo down')
        );
        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        expect(
            screen
                .getAllByTestId('analyst-actions')
                .at(-1)
                ?.getAttribute('data-count')
        ).toBe('3');
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('[AnalystActionsSection] Yahoo history'),
            expect.any(Error)
        );
        mockGetAnalystActionHistory.mockResolvedValueOnce([]);
        render(await AnalystActionsSection({ symbol: 'AAPL' }));
        expect(mockGetGradeEvents).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        warn.mockRestore();
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

describe('/[symbol]/news 최근 공시 섹션', () => {
    beforeEach(() => {
        mockShortenRevalidate.mockClear();
        mockListCompanyFilings.mockReset();
    });

    const filing = (n: number) => ({
        accession: `0001193125-26-46101${n}`,
        form: '8-K' as const,
        filedAt: '2026-11-13',
        items: [],
        headline: null,
        hasPressRelease: false,
        url: 'https://www.sec.gov/Archives/edgar/data/1/x.htm',
    });

    it('목록이 있으면 그린다', async () => {
        mockListCompanyFilings.mockResolvedValueOnce({
            status: 'ok',
            filings: [filing(1), filing(2)],
        });
        const node = await CompanyFilingsSection({ symbol: 'IONQ' });
        render(<>{node}</>);
        expect(
            screen.getByTestId('company-filings').getAttribute('data-count')
        ).toBe('2');
    });

    it.each([
        ['SEC 공시 대상 아님', { status: 'no_sec_filer' as const }],
        ['빈 목록', { status: 'ok' as const, filings: [] }],
    ])('%s이면 섹션을 그리지 않는다', async (_name, result) => {
        mockListCompanyFilings.mockResolvedValueOnce(result);
        expect(await CompanyFilingsSection({ symbol: 'IONQ' })).toBeNull();
    });

    it('예산(4초) 안에 오지 않으면 섹션을 빼고 이번 렌더의 revalidate를 낮춘다(캐시가 곧 채워진다)', async () => {
        vi.useFakeTimers();
        try {
            mockListCompanyFilings.mockReturnValueOnce(new Promise(() => {}));
            const pending = CompanyFilingsSection({ symbol: 'IONQ' });
            await vi.advanceTimersByTimeAsync(4_000);
            expect(await pending).toBeNull();
            expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('SEC·DB 실패는 경고만 남기고 섹션을 빼며, 경고 카드도 revalidate 단축도 없다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockListCompanyFilings.mockResolvedValueOnce({ status: 'failed' });
        expect(await CompanyFilingsSection({ symbol: 'IONQ' })).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('[CompanyFilingsSection]'),
            expect.any(Error)
        );
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
        warn.mockRestore();
    });
});
