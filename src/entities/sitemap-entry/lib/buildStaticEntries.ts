import { MS_PER_HOUR } from '@/shared/config/time';
import { PRIVACY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/shared/lib/seo';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { ALL_NAV_REGION_LINKS } from '@/shared/config/assetClassNav';
import { floorToHour } from './floorToHour';
import type { SitemapEntry } from '../model';

/** `now`가 속한 UTC 날짜의 자정. 하루에 한 번만 바뀌는 lastmod를 만든다. */
function startOfUtcDay(now: Date): Date {
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
}

/**
 * 정적 라우트(home, 각 버티컬의 지역 페이지, backtesting, legal, news hub + 카테고리 페이지)의
 * sitemap 엔트리.
 *
 * **`lastmod`에 요청 시각(`now`)을 그대로 쓰지 않는다.** sitemap 라우트가
 * `force-dynamic`이라 그렇게 하면 크롤러가 가져갈 때마다 값이 바뀌어, 실제로는
 * 바뀌지 않은 페이지에도 매번 freshness 신호를 보내게 된다. 네 등급으로 나눈다:
 *
 *  1. **빌드 시점 고정**(`SITE_BUILD_DATE`) — 배포로만 바뀌는 페이지.
 *     home, backtesting, economy, privacy, terms.
 *  2. **직전 마감 세션**(`lastClosedSessionCloseUtc`) — 미국 장 세션 단위로 값이
 *     바뀌는 페이지. `/fear-greed`가 여기 해당한다: 입력이 EOD 종가라 "내용이
 *     마지막으로 바뀐 시점"이 곧 직전 마감이다. 주말·DST는 헬퍼가 처리한다.
 *  3. **일 경계 양자화**(`startOfUtcDay`) — 하루 단위로 도는 페이지. news hub와
 *     5개 카테고리(ISR revalidate 24h). 하루에 한 번만 값이 바뀐다.
 *  4. **1시간 슬라이딩, 정시로 내림**(`oneHourAgo`, `floorToHour`) — `/market`만.
 *     장중 신호 스캐너를 노출하는 실시간성 페이지이고 ISR revalidate도 1h라 슬라이딩이
 *     실제 갱신 주기와 맞는다. 정시로 내림하지 않으면(=raw `now - 1h`) 이 라우트가
 *     `force-dynamic`이라 매 호출마다 값이 달라져, 결국 등급 1~3까지 포함한 세
 *     sitemap 자식 전부의 index lastmod가 이 값에 끌려다니며 항상 "방금 바뀜"으로
 *     나간다 — 등급을 나눈 목적 자체가 무력화된다.
 *
 * `changeFrequency`/`priority`는 lastmod와 독립적인 편집 의도다:
 * `/fear-greed`와 news 계열은 daily + 0.8(market 0.9보다 낮고 legal 0.3보다 높음).
 *
 * `now`를 인자로 받는 순수 함수라 테스트에서 시간 mock 없이 결정적 검증 가능.
 */
export function buildStaticEntries(now: Date): SitemapEntry[] {
    // floorToHour: rolling `now - 1h`를 그대로 쓰면 매 호출(=매 크롤)마다 값이
    // 달라져 sitemap index lastmod의 freshness 신호가 무력화된다 —
    // `buildPopularEntries`의 `/news` 엔트리와 같은 이유(floorToHour JSDoc 참고).
    const oneHourAgo = floorToHour(new Date(now.getTime() - MS_PER_HOUR));
    const todayUtc = startOfUtcDay(now);
    // `/fear-greed`는 미국 지수·ETF의 EOD 종가가 입력이므로 NYSE 세션 기준이다.
    const lastSessionClose = lastClosedSessionCloseUtc(US_EQUITY_SESSION, now);
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so Object.keys is exactly the union — TS just widens to string[].
    const newsCategoryEntries: SitemapEntry[] = (
        Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[]
    ).map(cat => ({
        url: `${SITE_URL}/news/${CATEGORY_CONFIG[cat].slug}`,
        lastModified: todayUtc,
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    /*
     * 버티컬 지역 페이지는 `ALL_NAV_REGION_LINKS`에서 파생한다 — 내비에 열어 둔
     * 지역과 sitemap에 광고하는 지역이 어긋나지 않게 하기 위해서다. 손으로 나열하면
     * 지역을 하나 더 열 때 sitemap 쪽을 빠뜨려도 아무것도 깨지지 않는다(조용한 누락).
     *
     * 뉴스 지역 링크는 여기서 제외한다 — `/news/crypto`처럼 카테고리 페이지와 URL이
     * 겹쳐 `newsCategoryEntries`가 이미 내보내고 있어, 넣으면 같은 URL이 두 번 나간다.
     */
    const regionEntries: SitemapEntry[] = ALL_NAV_REGION_LINKS.flatMap(link => {
        if (link.href.startsWith('/news/')) return [];
        const isMarket = link.href.startsWith('/market');
        return [
            {
                url: `${SITE_URL}${link.href}`,
                // 등급은 버티컬 성격을 따른다: `/market*`은 장중 신호라 1시간 슬라이딩,
                // `/fear-greed*`는 EOD 입력이라 직전 마감, `/economy*`는 배포 단위.
                lastModified: isMarket
                    ? oneHourAgo
                    : link.href.startsWith('/fear-greed')
                      ? lastSessionClose
                      : SITE_BUILD_DATE,
                changeFrequency: isMarket
                    ? ('hourly' as const)
                    : ('daily' as const),
                priority: isMarket ? 0.9 : 0.8,
            },
        ];
    });

    return [
        {
            url: SITE_URL,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 1,
        },
        ...regionEntries,
        {
            url: `${SITE_URL}/backtesting`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/news`,
            lastModified: todayUtc,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/news/us`,
            lastModified: todayUtc,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        ...newsCategoryEntries,
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ];
}
