import { cache } from 'react';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_CACHE_TAG_PREFIX } from '@/entities/market-news/lib/marketNewsConstants';
import { getMarketNewsCards } from '@/entities/market-news/api/marketNewsRepository';
import { PREVIEW_HEADLINE_LIMIT } from '@/widgets/news-hub/CategoryCard';
import { cacheNonEmpty } from '@/shared/cache/cacheNonEmpty';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 허브 카드에 띄울 상위 헤드라인(로케일별 제목). `/news`·`/news/us` 두 허브가 쓰므로 `_lib`에 둔다.
 *
 * - `cacheNonEmpty`(속은 `staticSymbolCache`, 축 1)로 감싸 ISR cold-gen의 DB 호출이
 *   `DYNAMIC_SERVER_USAGE`를 던지지 않게 한다. 빈 목록은 캐시하지 않는다 — 기사 적재 전
 *   순간의 `[]`가 24h 굳으면 카드가 하루 내내 "불러오고 있어요"로 남는다.
 * - DB가 throw해도 `cacheNonEmpty`가 흡수해 `[]`로 degrade한다. 카테고리별로 잡으므로
 *   하나가 실패해도 나머지 카드와 허브 크롬은 정상이다.
 * - 캐시는 원본 행(titleKo/titleEn 둘 다)을 저장하고 로케일별 제목 선택은 캐시 **바깥**에서
 *   하므로, 제목 로케일이 캐시 키에 없어도 오염되지 않는다.
 * - 요청당 한 번: `React.cache`로 감싼다. 허브의 `generateMetadata`(noindex 판정)와 본문이
 *   같은 카테고리를 읽는데 `unstable_cache`는 요청 안에서 dedup하지 않는다.
 */
export const fetchCategoryPreviews = cache(async function fetchCategoryPreviews(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<string[]> {
    const cfg = CATEGORY_CONFIG[category];
    const rows = await cacheNonEmpty(
        ['market-news:list', cfg.sentinel, ...contentLocaleKeyPart(locale)],
        cfg.sentinel,
        () => getMarketNewsCards(cfg.sentinel, locale),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`],
        SECONDS_PER_DAY
    );
    return rows
        .slice(0, PREVIEW_HEADLINE_LIMIT)
        .map(row => resolveNewsTitle(row, locale));
});
