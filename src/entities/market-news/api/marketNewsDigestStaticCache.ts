import 'server-only';
import {
    peekMarketNewsDigestCache,
    type NewsAnalysisResponse,
} from '@y0ngha/siglens-core';
import { cacheNonNull } from '@/shared/cache/cacheNonNull';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import { selectDigestNews, toCoreFeedCategory } from '../lib/digestInput';
import {
    DEFAULT_DIGEST_MODEL_ID,
    DIGEST_REASONING,
} from '../lib/marketNewsConstants';
import { getMarketNewsList } from './marketNewsRepository';

/**
 * `peekMarketNewsDigestStatic`의 카테고리별 캐시 태그. 무효화하는 쪽(허브 프리웜 등)은
 * 반드시 이 빌더를 써야 한다 — 따로 철자하면 한쪽만 바뀌는 순간 무효화가 빗나가 ISR이
 * stale하게 남는다.
 */
export function marketNewsDigestCacheTag(category: NewsFeedCategoryId): string {
    return `market-news:digest:${category}`;
}

/**
 * /news/[category] SSR seed — 캐시된 카테고리 다이제스트를 읽기 전용으로 peek한다.
 *
 * `submitMarketNewsDigestAction`과 정확히 같은 `news`(같은 `getMarketNewsList` 쿼리 +
 * `selectDigestNews`)와 캐시 키에 참여하는 같은 옵션(`category`, `modelId`, `news`,
 * `reasoning`, `locale`)을 만든다 — `peekMarketNewsDigestCache`가 이 필드들에서 캐시 키를
 * 파생하므로 어긋나면 아무도 쓰지 않은 키를 읽어 영원히 miss다(core JSDoc도 경고한다).
 * `categoryLabel`/`skipEnqueueIfMiss`/`signal`은 런타임 전용이라 core의
 * `MarketNewsDigestCacheKeyOptions`가 키에서 제외하므로 여기서도 만들지 않는다.
 *
 * LLM 비용 0, enqueue 0 — 캐시 miss(콜드 캐시, provider 없음, 읽기 오류)는 `null`로
 * 풀리고(`cacheNonNull`이 캐시하지 않는다) 클라이언트가 `submitMarketNewsDigestAction`의
 * `runMarketNewsDigest`로 폴백한다.
 *
 * `revalidate=SECONDS_PER_HALF_DAY`는 core 다이제스트 캐시 TTL(24h)이 아니라 이 페이지
 * 자신의 ISR 주기(`/news/[category]/page.tsx`의 `revalidate = 43200`)에 맞춘다 — peek는
 * 페이지가 재생성되는 만큼만 신선하면 된다.
 */
export async function peekMarketNewsDigestStatic(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<NewsAnalysisResponse | null> {
    // `cacheNonNull` — miss(`null`)는 캐시하지 않고 SSR miss로 표시한다. 예전에는 그
    // `null`이 12h 굳어, 방문자가 곧 다이제스트를 생성해도 페이지는 반나절 비어 있었다.
    // 읽기 실패도 `null`(플레이스홀더)로 degrade한다 — 예전 try/catch와 같다.
    return cacheNonNull(
        () => computeDigestPeek(category, locale),
        ['market-news-digest-peek-static', category, locale],
        {
            revalidate: SECONDS_PER_HALF_DAY,
            tags: [marketNewsDigestCacheTag(category)],
        }
    );
}

async function computeDigestPeek(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<NewsAnalysisResponse | null> {
    const { sentinel } = CATEGORY_CONFIG[category];
    const rows = await getMarketNewsList(sentinel);
    const news = selectDigestNews(rows);

    return peekMarketNewsDigestCache({
        category: toCoreFeedCategory(category),
        locale,
        modelId: DEFAULT_DIGEST_MODEL_ID,
        news,
        reasoning: DIGEST_REASONING,
    });
}
