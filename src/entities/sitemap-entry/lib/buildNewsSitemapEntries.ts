import {
    CATEGORY_CONFIG,
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_LOOKBACK_MS } from '@/entities/market-news/lib/marketNewsConstants';
import { MS_PER_HOUR } from '@/shared/config/time';

import type { SitemapEntry } from '../model';
import { latestOf } from './latestOf';
import { staticSitemapEntry } from './staticSitemapEntry';

/**
 * 카테고리 페이지가 ISR로 서빙할 수 있는 목록의 최대 나이(시간). `news/[category]/page.tsx`의
 * `export const revalidate`(초)를 시간으로 옮긴 값이다 — 라우트 segment config는 리터럴이어야
 * 해서 그 상수를 import할 수 없다. 두 값이 어긋나지 않는 것은 `src/__tests__/guards/newsPageRevalidateParity.test.ts`가
 * 고정한다.
 */
export const NEWS_PAGE_MAX_STALENESS_HOURS = 12;

/**
 * 뉴스 카테고리를 sitemap에서 빼는 정체 기준 — **페이지의 색인 기준과 같은 창**이다.
 *
 * 카테고리 페이지는 `MARKET_NEWS_LOOKBACK_MS`(7일) 안의 카드가 하나도 없으면 noindex다
 * (`news/[category]/page.tsx`). 그런데 페이지는 ISR로 최대 12시간 묵은 목록을 서빙하므로,
 * sitemap은 **"지금 시각 기준 최신 기사가 창 안"이 아니라 "12시간 전에 페이지가 읽었을 때도
 * 창 안이었음"**이 확실한 카테고리만 싣는다 — 최신 기사 시각이 `창 − 12h`보다 최근이어야
 * 한다. 예전에는 임의의 14일을 썼다: 페이지가 이미 noindex가 된 7~14일 구간의 카테고리가
 * sitemap에 남아 "sitemap에 있는데 noindex"(GSC 오류)였다. 2026-09-17 운영 크롤의
 * `/news/forex`(마지막 기사 3주 전)가 그 계열이다.
 */
const STALE_NEWS_CATEGORY_MS =
    MARKET_NEWS_LOOKBACK_MS - NEWS_PAGE_MAX_STALENESS_HOURS * MS_PER_HOUR;

/** 뉴스 허브·미국 허브·카테고리 페이지의 엔트리와 허브 lastmod. */
export interface NewsSitemapEntries {
    /** 싣는 카테고리 페이지(`/news/{slug}`)의 엔트리. */
    readonly categoryEntries: readonly SitemapEntry[];
    /** `/news`의 lastmod — 싣는 카테고리들의 최신값. */
    readonly hubLastModified: Date;
    /** `/news/us`의 lastmod — 싣는 미국 카테고리들의 최신값. */
    readonly usLastModified: Date;
}

/**
 * `buildStaticEntries`의 뉴스 부분. `newsLatestPublishedAt`의 `undefined`(로더 실패)와 `{}`
 * (기사 0건)의 구분은 `BuildStaticEntriesOptions`가 정의한다. 기사 시각을 모르는 카테고리와
 * 허브는 `fallback`(UTC 자정)으로 떨어진다.
 */
export function buildNewsSitemapEntries(
    now: Date,
    newsLatestPublishedAt:
        | Partial<Record<NewsFeedCategoryId, Date>>
        | undefined,
    fallback: Date
): NewsSitemapEntries {
    // 로더가 실패했으면(`undefined`) 아래 lastmod 조회에서 어떤 카테고리도 시각을 모른다.
    const latestOfCategory = (cat: NewsFeedCategoryId): Date | undefined =>
        newsLatestPublishedAt?.[cat];
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so Object.keys is exactly the union — TS just widens to string[].
    const allCategories = Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[];
    // 로더가 실패했으면 전부 싣는다 — 로더 장애로 sitemap에서 카테고리가 통째로 사라지는
    // 쪽이 더 나쁘다. 로더가 성공했으면 키가 없는 카테고리(기사 0건 = 페이지가 빈 상태)와
    // 창 밖으로 정체된 카테고리를 뺀다.
    const categories = allCategories.filter(cat => {
        if (newsLatestPublishedAt === undefined) return true;
        const latest = newsLatestPublishedAt[cat];
        return (
            latest !== undefined &&
            now.getTime() - latest.getTime() < STALE_NEWS_CATEGORY_MS
        );
    });
    // `/news/us`도 **싣는 카테고리만** 본다. 정체돼 sitemap에서 빠진 카테고리의 시각을 쓰면,
    // 허브가 자기가 더 이상 나열하지 않는 글을 근거로 신선도를 주장한다.
    const included = new Set(categories);
    const usCategories = categoriesInRegion('us').filter(cat =>
        included.has(cat)
    );

    return {
        categoryEntries: categories.map(cat =>
            staticSitemapEntry(
                `/news/${CATEGORY_CONFIG[cat].slug}`,
                latestOfCategory(cat) ?? fallback,
                'daily',
                0.8
            )
        ),
        // 허브는 자기가 나열하는 카테고리들의 최신값이다 — 별도 조회를 두면 두 값이
        // 어긋나 "허브가 카테고리보다 신선하다"는 불가능한 주장을 하게 된다.
        hubLastModified: latestOf(categories.map(latestOfCategory), fallback),
        usLastModified: latestOf(usCategories.map(latestOfCategory), fallback),
    };
}
