import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { sitemapAlternates } from './sitemapAlternates';
import {
    ABOUT_PATH,
    ABOUT_UPDATED_AT,
    PRIVACY_PATH,
    TERMS_PATH,
} from '@/shared/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/shared/lib/seo';
import { MS_PER_DAY } from '@/shared/config/time';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import type { TermsKind } from '@/shared/db/constants';
import { ALL_NAV_REGION_LINKS } from '@/shared/config/assetClassNav';
import type { SitemapEntry } from '../model';

/** `now`가 속한 UTC 날짜의 자정. 하루에 한 번만 바뀌는 lastmod를 만든다. */
function startOfUtcDay(now: Date): Date {
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
}

/** `buildStaticEntries`에 주입하는 콘텐츠 갱신 시각들. 전부 선택이다. */
export interface BuildStaticEntriesOptions {
    /**
     * 카테고리 버킷별 최신 기사 `publishedAt`. news hub(`/news`)와
     * `/news/us`는 여기서 파생한다 — 허브 값을 따로 주입받으면 카테고리와
     * 어긋난 lastmod를 발행할 수 있다(허브가 보여주는 것이 정확히 그 카테고리들이다).
     */
    readonly newsLatestPublishedAt?: Partial<Record<NewsFeedCategoryId, Date>>;
    /** 활성 약관·방침 버전의 발효일. 없으면 `SITE_BUILD_DATE`로 떨어진다. */
    readonly legalEffectiveDates?: Partial<Record<TermsKind, Date>>;
    /**
     * `/backtesting`이 싣는 데이터의 마지막 케이스 진입일.
     *
     * 이 페이지의 본문은 `src/app/[locale]/backtesting/data.json` 고정 산출물이라
     * 배포로 바뀌지 않는다(같은 내용의 사본이 `public/`에도 있고 손으로 맞춘다 —
     * 화면과 이 lastmod는 둘 다 `src/` 쪽을 읽는다). `SITE_BUILD_DATE`를 쓰면 릴리스마다 "방금 바뀜"을 주장하게 되고,
     * lastmod가 부정확하면 Google은 그 sitemap의 lastmod 전체를 무시한다.
     */
    readonly backtestingDataDate?: Date;
}

/**
 * 뉴스 카테고리를 sitemap에서 빼는 정체 기준.
 *
 * 카테고리 페이지는 카드가 하나도 없으면 noindex다(`news/[category]/page.tsx`).
 * 2026-09-17 운영 크롤에서 `/news/forex`가 정확히 그 상태로 sitemap에 실려 있었다 —
 * 마지막 기사가 3주 전이었다. sitemap은 색인 대상만 실어야 한다.
 */
const STALE_NEWS_CATEGORY_MS = 14 * MS_PER_DAY;

/** 후보 중 가장 최근 값. 후보가 없으면 `fallback`. */
function latestOf(
    candidates: readonly (Date | undefined)[],
    fallback: Date
): Date {
    const known = candidates.filter((d): d is Date => d !== undefined);
    if (known.length === 0) return fallback;
    return known.reduce((max, d) => (d.getTime() > max.getTime() ? d : max));
}

/**
 * 정적 라우트(home, 각 버티컬의 지역 페이지, backtesting, legal, news hub + 카테고리 페이지)의
 * sitemap 엔트리.
 *
 * **`lastmod`에 요청 시각(`now`)을 그대로 쓰지 않는다.** sitemap 라우트가
 * `force-dynamic`이라 그렇게 하면 크롤러가 가져갈 때마다 값이 바뀌어, 실제로는
 * 바뀌지 않은 페이지에도 매번 freshness 신호를 보내게 된다. 네 등급으로 나눈다:
 *
 *  1. **콘텐츠 자체의 갱신 시각** — 그 값을 알 수 있는 페이지. `/about`은
 *     `ABOUT_UPDATED_AT`(본문 상수), `/privacy`·`/terms`는 활성 약관 버전의
 *     발효일(`legalEffectiveDates`), news 계열은 그 버킷의 최신 기사
 *     `publishedAt`(`newsLatestPublishedAt`), `/backtesting`은 정적 데이터셋의
 *     마지막 진입일(`backtestingDataDate`)이다. 주입되지 않으면 4등급으로
 *     떨어진다 — 이 빌더는 I/O를 하지 않는다.
 *  2. **직전 마감 세션**(`lastClosedSessionCloseUtc`) — 거래 세션 단위로 값이
 *     바뀌는 페이지. `/fear-greed*`와 `/market*`이 여기 해당한다: 입력이 봉이라
 *     "내용이 마지막으로 바뀐 시점"이 곧 직전 마감이다. 주말·휴장·DST는 헬퍼가
 *     처리한다. 거래소가 다르므로 지역별로 따로 계산한다.
 *  3. **UTC 일 경계**(`todayUtc`) — 하루 주기로 갱신되는 페이지. `/economy*`가
 *     여기 해당한다(지표가 24시간마다 새로 들어오고 페이지 FAQ도 그렇게 밝힌다).
 *     배포 시각을 쓰면 하루에 세 번 배포한 날 세 번 바뀌었다고 주장하게 된다
 *     (2026-09-17 감사). 최신 기사 시각이 주입되지 않은 news 카테고리도 여기로
 *     떨어진다.
 *  4. **빌드 시점 고정**(`SITE_BUILD_DATE`) — 배포로만 바뀌는 페이지(home), 그리고
 *     1등급 값이 주입되지 않았을 때의 폴백(`/backtesting`·legal).
 *
 * `/market*`은 예전에 "1시간 슬라이딩, 정시로 내림"이었다. ISR revalidate가 1h라
 * 갱신 *주기*와는 맞았지만 lastmod가 주장하는 것은 주기가 아니라 **마지막 변경
 * 시각**이고, 장이 닫힌 뒤에는 매시간 "방금 바뀌었다"는 거짓 신호가 됐다
 * (주말 내내 그랬다). 신호 스캐너의 입력은 봉이므로 세션 마감이 사실이다 —
 * `buildPopularEntries`가 종목 URL에서 이미 쓰는 근거와 같다.
 *
 * `changeFrequency`/`priority`는 lastmod와 독립적인 편집 의도다:
 * `/fear-greed`와 news 계열은 daily + 0.8(market 0.9보다 낮고 legal 0.3보다 높음).
 *
 * `now`와 옵션만 보는 순수 함수라 테스트에서 시간 mock 없이 결정적 검증 가능하다.
 * 주입값은 라우트가 `unstable_cache`로 읽어 넘긴다.
 */
export function buildStaticEntries(
    now: Date,
    options: BuildStaticEntriesOptions = {}
): SitemapEntry[] {
    const {
        newsLatestPublishedAt = {},
        legalEffectiveDates = {},
        backtestingDataDate,
    } = options;
    const todayUtc = startOfUtcDay(now);
    // `/fear-greed`·`/market`은 봉이 입력이라 "직전 마감"이 곧 lastmod다. 두 지역이
    // 서로 다른 거래소를 보므로 세션도 따로 계산한다 — KRX는 06:30 UTC, NYSE는
    // 21:00 UTC에 닫혀서, 한 시계로 통일하면 하루 14시간 넘게 KR 엔트리가 실제
    // 변경 시각보다 뒤처지고 KRX만 여는 날에는 바뀌지도 않은 변경을 주장한다.
    // (`buildPopularEntries`가 종목 URL에서 이미 같은 분기를 한다.)
    const lastSessionClose = lastClosedSessionCloseUtc(US_EQUITY_SESSION, now);
    const lastKrSessionClose = lastClosedSessionCloseUtc(
        KR_EQUITY_SESSION,
        now
    );
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so Object.keys is exactly the union — TS just widens to string[].
    const allNewsCategories = Object.keys(
        CATEGORY_CONFIG
    ) as NewsFeedCategoryId[];
    // 최신 기사 시각을 못 읽었으면(주입 실패) 싣는다 — 로더 장애로 sitemap에서
    // 카테고리가 통째로 사라지는 쪽이 더 나쁘다.
    const newsCategories = allNewsCategories.filter(cat => {
        const latest = newsLatestPublishedAt[cat];
        return (
            latest === undefined ||
            now.getTime() - latest.getTime() < STALE_NEWS_CATEGORY_MS
        );
    });
    const newsCategoryEntries: SitemapEntry[] = newsCategories.map(cat => ({
        url: `${SITE_URL}/news/${CATEGORY_CONFIG[cat].slug}`,
        lastModified: newsLatestPublishedAt[cat] ?? todayUtc,
        changeFrequency: 'daily' as const,
        priority: 0.8,
        alternates: sitemapAlternates(
            `/news/${CATEGORY_CONFIG[cat].slug}`,
            STATIC_INDEXABLE_LOCALES
        ),
    }));
    // 허브는 자기가 나열하는 카테고리들의 최신값이다 — 별도 조회를 두면 두 값이
    // 어긋나 "허브가 카테고리보다 신선하다"는 불가능한 주장을 하게 된다.
    const newsHubLastModified = latestOf(
        newsCategories.map(cat => newsLatestPublishedAt[cat]),
        todayUtc
    );
    // `/news/us`도 **싣는 카테고리만** 본다. 정체돼 sitemap에서 빠진 카테고리의
    // 시각을 쓰면, 허브가 자기가 더 이상 나열하지 않는 글을 근거로 신선도를 주장한다.
    const freshUsCategories = categoriesInRegion('us').filter(cat =>
        newsCategories.includes(cat)
    );
    const newsUsLastModified = latestOf(
        freshUsCategories.map(cat => newsLatestPublishedAt[cat]),
        todayUtc
    );

    /*
     * 버티컬 지역 페이지는 `ALL_NAV_REGION_LINKS`에서 파생한다 — 내비에 열어 둔
     * 지역과 sitemap에 광고하는 지역이 어긋나지 않게 하기 위해서다. 손으로 나열하면
     * 지역을 하나 더 열 때 sitemap 쪽을 빠뜨려도 아무것도 깨지지 않는다(조용한 누락).
     *
     * 뉴스 지역 링크는 여기서 제외한다 — `/news/crypto`처럼 카테고리 페이지와 URL이
     * 겹쳐 `newsCategoryEntries`가 이미 내보내고 있어, 넣으면 같은 URL이 두 번 나간다.
     */
    /**
     * 등급은 버티컬 성격을 따른다: `/market*`·`/fear-greed*`는 봉이 입력이라
     * 직전 마감(거래소가 다르므로 지역별로), `/economy*`는 배포 단위.
     */
    function lastModifiedFor(
        link: (typeof ALL_NAV_REGION_LINKS)[number]
    ): Date {
        if (
            !link.href.startsWith('/market') &&
            !link.href.startsWith('/fear-greed')
        ) {
            // `/economy*`는 지표가 하루 주기로 갱신된다(페이지 FAQ가 그렇게 밝힌다).
            // 배포 시각을 쓰면 하루에 세 번 배포한 날 세 번 "바뀌었다"고 주장하게 된다.
            return todayUtc;
        }
        return link.region === 'kr' ? lastKrSessionClose : lastSessionClose;
    }

    const regionEntries: SitemapEntry[] = ALL_NAV_REGION_LINKS.flatMap(link => {
        if (link.href.startsWith('/news/')) return [];
        const isMarket = link.href.startsWith('/market');
        return [
            {
                url: `${SITE_URL}${link.href}`,
                lastModified: lastModifiedFor(link),
                changeFrequency: isMarket
                    ? ('hourly' as const)
                    : ('daily' as const),
                priority: isMarket ? 0.9 : 0.8,
                alternates: sitemapAlternates(
                    link.href,
                    STATIC_INDEXABLE_LOCALES
                ),
            },
        ];
    });

    return [
        {
            url: SITE_URL,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 1,
            alternates: sitemapAlternates('/', STATIC_INDEXABLE_LOCALES),
        },
        ...regionEntries,
        {
            url: `${SITE_URL}/backtesting`,
            lastModified: backtestingDataDate ?? SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 0.9,
            alternates: sitemapAlternates(
                '/backtesting',
                STATIC_INDEXABLE_LOCALES
            ),
        },
        {
            /**
             * 종목 디렉터리. 목록은 상수(`POPULAR_TICKERS`·`POPULAR_CRYPTOS`)라
             * **배포로만** 바뀌므로 lastmod가 배포 시각인 것이 정직하다.
             * priority는 허브(0.8)보다 낮게 둔다 — 이 페이지의 값은 자기 본문이
             * 아니라 종목 페이지로 내보내는 링크에 있다.
             */
            url: `${SITE_URL}/symbols`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 0.6,
            alternates: sitemapAlternates('/symbols', STATIC_INDEXABLE_LOCALES),
        },
        {
            url: `${SITE_URL}/news`,
            lastModified: newsHubLastModified,
            changeFrequency: 'daily',
            priority: 0.8,
            alternates: sitemapAlternates('/news', STATIC_INDEXABLE_LOCALES),
        },
        {
            url: `${SITE_URL}/news/us`,
            lastModified: newsUsLastModified,
            changeFrequency: 'daily',
            priority: 0.8,
            alternates: sitemapAlternates('/news/us', STATIC_INDEXABLE_LOCALES),
        },
        ...newsCategoryEntries,
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: legalEffectiveDates.privacy ?? SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
            alternates: sitemapAlternates(
                PRIVACY_PATH,
                STATIC_INDEXABLE_LOCALES
            ),
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: legalEffectiveDates.tos ?? SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
            alternates: sitemapAlternates(TERMS_PATH, STATIC_INDEXABLE_LOCALES),
        },
        // `/about` — 운영 주체·방법론·면책. legal(0.3)보다 한 단계 위: YMYL 재평가에서
        // 사이트 전체의 신뢰 앵커라 크롤러가 먼저 보게 둔다(SEO_RECOVERY_2026_09 §5-B1).
        {
            url: `${SITE_URL}${ABOUT_PATH}`,
            // 본문이 코드 상수라 갱신 시각도 코드가 안다 — 배포 시각을 쓰면
            // 본문을 한 줄도 안 바꾼 배포까지 "갱신됨"으로 나간다.
            lastModified: ABOUT_UPDATED_AT,
            changeFrequency: 'yearly',
            priority: 0.4,
            alternates: sitemapAlternates(ABOUT_PATH, STATIC_INDEXABLE_LOCALES),
        },
    ];
}
