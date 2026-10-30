import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import type { Locale } from '@/shared/i18n/locales';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import { stripUtmParams } from '@/shared/lib/stripUtmParams';

/**
 * 카테고리 기사 목록의 `ItemList` 구조화데이터. 기사가 없으면 `null`(빈 목록을 선언하지 않는다).
 *
 * - 초기 DOM에 실제로 그려지는 카드 수(`MARKET_NEWS_LIST_PAGE_SIZE`)로 자른다.
 * - 제3자 기사를 `Article`로 선언하지 않는다: `url`은 외부 매체가 발행한 기사인데
 *   `datePublished`·`author`·`publisher`를 달면 이 페이지가 호스팅하지 않는 콘텐츠의 저작을
 *   주장하게 된다. 목록 항목(위치·URL·이름)까지만 말하고, URL의 `utm_*` 추적 파라미터는 뗀다.
 */
export function buildNewsItemListJsonLd(
    items: readonly MarketNewsCardItem[],
    name: string,
    locale: Locale
): Record<string, unknown> | null {
    if (items.length === 0) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name,
        itemListElement: items
            .slice(0, MARKET_NEWS_LIST_PAGE_SIZE)
            .map((item, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                url: stripUtmParams(item.url),
                name: resolveNewsTitle(item, locale),
            })),
    };
}
