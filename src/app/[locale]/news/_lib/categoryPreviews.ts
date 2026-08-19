import {
    CATEGORY_CONFIG,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { getMarketNewsCards } from '@/entities/market-news/api';
import { PREVIEW_HEADLINE_LIMIT } from '@/widgets/news-hub';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 허브 카드에 띄울 상위 헤드라인.
 *
 * `/news`(3지역 허브)와 `/news/us`(미국 카테고리 허브)가 같은 로직을 쓰므로
 * `_lib`에 둔다 — 라우트 파일끼리 import하면 어느 쪽이 소유자인지 흐려진다.
 *
 * `staticSymbolCache`(축 1)로 감싸 ISR cold-gen에서 DB 호출이
 * `DYNAMIC_SERVER_USAGE`를 던지는 것을 막는다. 한국어 제목이 있으면 그것을,
 * 없으면 원문 언어 제목을 쓴다.
 *
 * **ISR degrade guard**: DB가 throw해도 ISR 캐시에 0-byte 빈 결과가 굳지 않도록
 * 여기서 흡수해 `[]`로 degrade한다 — 카드가 "최신 뉴스를 불러오고 있어요"로
 * 렌더되고 허브 전체 크롬은 유지된다. 카테고리별로 catch하므로 하나가 실패해도
 * 나머지 카드는 정상이다.
 */
export async function fetchCategoryPreviews(
    category: NewsFeedCategoryId
): Promise<string[]> {
    const cfg = CATEGORY_CONFIG[category];
    const rows = await staticSymbolCache(
        ['market-news:list', cfg.sentinel],
        cfg.sentinel,
        () => getMarketNewsCards(cfg.sentinel),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            `[newsHub] fetchCategoryPreviews(${category}) failed, degrading to []:`,
            e
        );
        return [] as Awaited<ReturnType<typeof getMarketNewsCards>>;
    });
    return rows
        .slice(0, PREVIEW_HEADLINE_LIMIT)
        .map(row => row.titleKo ?? row.titleEn);
}
