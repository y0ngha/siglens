import { cache } from 'react';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { MARKET_NEWS_CACHE_TAG_PREFIX } from '@/entities/market-news/lib/marketNewsConstants';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { getMarketNewsCards } from '@/entities/market-news/api/marketNewsRepository';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { cacheNonEmptyOrNull } from '@/shared/cache/cacheNonEmpty';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';

/** {@link loadCategorySnapshot} 결과. `isEmpty`가 noindex와 degrade UI의 단일 술어다. */
export interface CategorySnapshot {
    readonly items: MarketNewsCardItem[];
    readonly isEmpty: boolean;
}

/**
 * 카테고리 목록을 읽고 비었는지 판정한다 — `generateMetadata`와 본문이 함께 불러 noindex와
 * degrade UI가 같은 판정에서 나온다.
 *
 * - `cacheNonEmptyOrNull`(속은 `staticSymbolCache`, 축 1)로 감싸 ISR cold-gen의 DB 읽기가
 *   `DYNAMIC_SERVER_USAGE`를 던지지 않게 한다. 빈 목록은 캐시하지 않는다 — 기사가 적재되기 전
 *   순간의 `[]`가 12h 굳으면 다이제스트가 구워진 뒤에도 목록만 비어 남는다. DB 읽기 실패는
 *   `null`로 구분돼 흡수된다(ISR에 0-byte 결과가 굳지 않는다).
 * - 읽기 자체가 카드 투영이라 서버 전용 컬럼(bodyEn/symbol/analyzedAt)은 SELECT되지 않는다.
 * - 요청당 한 번: `React.cache`로 감싼다. `unstable_cache`는 요청 안에서 dedup하지 않아
 *   메타데이터와 본문이 같은 목록을 캐시 핸들러에서 두 번 읽는다.
 */
export const loadCategorySnapshot = cache(async function loadCategorySnapshot(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<CategorySnapshot> {
    const cfg = CATEGORY_CONFIG[category];
    const loaded = await cacheNonEmptyOrNull(
        ['market-news:list', cfg.sentinel, ...contentLocaleKeyPart(locale)],
        cfg.sentinel,
        () => getMarketNewsCards(cfg.sentinel, locale),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`],
        SECONDS_PER_HALF_DAY
    );
    // 읽기가 **실패**했을 때만(`null`) 이 렌더의 revalidate를 낮춘다. 건강한 빈 상태(`[]` —
    // 기사가 정말 없는 카테고리)는 라우트 기본 revalidate를 유지한다: 장애가 아닌데 짧게
    // 재생성하면 만성 빈 카테고리가 크롤마다 DB를 다시 읽는다. 둘 다 noindex 렌더라는 점은
    // 같다. 캐시 함수 **바깥**(페이지 렌더 경로)이라 하향이 먹고, 첫 호출에서 한 번 일어난다.
    if (loaded === null) await shortenRevalidateForRuntimeDegrade();
    const rows = loaded ?? [];
    return { items: rows, isEmpty: rows.length === 0 };
});
