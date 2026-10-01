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
 * 허브 카드에 띄울 상위 헤드라인.
 *
 * `/news`(3지역 허브)와 `/news/us`(미국 카테고리 허브)가 같은 로직을 쓰므로
 * `_lib`에 둔다 — 라우트 파일끼리 import하면 어느 쪽이 소유자인지 흐려진다.
 *
 * `cacheNonEmpty`(속은 `staticSymbolCache`, 축 1)로 감싸 ISR cold-gen에서 DB 호출이
 * `DYNAMIC_SERVER_USAGE`를 던지는 것을 막는다. **빈 목록은 캐시하지 않는다** — 기사가
 * 적재되기 전 순간의 `[]`가 24h 굳으면 허브 카드가 하루 내내 "불러오고 있어요"로
 * 남는다(`/news/[category]` 목록과 같은 처방, `cacheNonEmpty` JSDoc). 캐시는 원본 행(titleKo/titleEn
 * 둘 다 포함)을 저장하고, 로케일별 제목 선택은 캐시 **바깥**(이 함수의 반환
 * 직전)에서 매 요청마다 하므로 로케일이 캐시 키에 없어도 오염되지 않는다.
 *
 * **ISR degrade guard**: DB가 throw해도 ISR 캐시에 0-byte 빈 결과가 굳지 않도록
 * `cacheNonEmpty`가 흡수해 `[]`로 degrade한다 — 카드가 "최신 뉴스를 불러오고 있어요"로
 * 렌더되고 허브 전체 크롬은 유지된다. 카테고리별로 catch하므로 하나가 실패해도
 * 나머지 카드는 정상이다.
 */
export async function fetchCategoryPreviews(
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
}
