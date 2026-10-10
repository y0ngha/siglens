/**
 * `loadNewsList`(React.cache) 요청 내 dedup을 고정한다 — 본문과 `NewsListSection`이 같은 목록을
 * 읽어도 `staticSymbolCache`(캐시 핸들러·S3 GET)를 한 번만 거친다.
 *
 * vitest는 RSC 요청 스코프가 없어 실제 `React.cache`가 메모하지 않는다. 그래서 `cache`를
 * "요청 하나" 동안 인자로 메모하는 구현으로 바꾸고, 테스트마다 그 스코프를 비운다.
 */
const { requestMemo } = vi.hoisted(() => ({
    requestMemo: new Map<unknown, Map<string, unknown>>(),
}));
vi.mock('react', async importOriginal => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            return (...args: A): R => {
                const memo = requestMemo.get(fn) ?? new Map<string, unknown>();
                requestMemo.set(fn, memo);
                const key = JSON.stringify(args);
                if (!memo.has(key)) memo.set(key, fn(...args));
                return memo.get(key) as R;
            };
        },
    };
});

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
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
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
    getFmpUserFacingKey: vi.fn(),
    translateFmpError: vi.fn().mockReturnValue(null),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsListSection } from '@/app/[locale]/[symbol]/news/page';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getNewsList } from '@/entities/news-article/api';

describe('loadNewsList 요청 내 dedup', () => {
    beforeEach(() => {
        requestMemo.clear();
        vi.mocked(staticSymbolCache).mockClear();
        vi.mocked(getNewsList).mockResolvedValue(
            [] as Awaited<ReturnType<typeof getNewsList>>
        );
    });

    it('같은 요청에서 두 번 읽어도 staticSymbolCache를 한 번만 부른다', async () => {
        await NewsListSection({ symbol: 'AAPL', locale: 'ko' });
        await NewsListSection({ symbol: 'AAPL', locale: 'ko' });

        expect(staticSymbolCache).toHaveBeenCalledTimes(1);
        expect(getNewsList).toHaveBeenCalledTimes(1);
    });

    it('인자(로케일)가 다르면 따로 읽는다', async () => {
        await NewsListSection({ symbol: 'AAPL', locale: 'ko' });
        await NewsListSection({ symbol: 'AAPL', locale: 'en' });

        expect(staticSymbolCache).toHaveBeenCalledTimes(2);
    });
});
