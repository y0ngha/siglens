import type { EnrichedNewsItem, NewsFeedCategory } from '@y0ngha/siglens-core';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import type { NewsFeedCategoryId } from './categoryConfig';
import { toEnrichedMarketNewsItem } from './toEnrichedMarketNewsItem';
import type { MarketNewsRow } from '../model';

/**
 * 다이제스트 입력 기사 — 보강이 끝난 행만 core 형상으로 바꾸고
 * `selectAggregateNewsItems`로 시장을 움직일 상위 기사만 남긴다(프롬프트 크기 상한).
 *
 * `submitMarketNewsDigestAction`(생성), `peekMarketNewsDigestStatic`(SSR peek),
 * seo-prewarm cron의 뉴스 허브가 같은 함수를 써야 한다 — core 캐시 키가 `news`에서
 * 파생되므로 경로별 입력이 어긋나면 peek가 아무도 쓰지 않은 키를 읽어 영원히 miss다.
 */
export function selectDigestNews(
    rows: readonly MarketNewsRow[]
): EnrichedNewsItem[] {
    const enriched = rows
        .map(toEnrichedMarketNewsItem)
        .filter((item): item is EnrichedNewsItem => item !== null);
    return selectAggregateNewsItems(enriched);
}

/**
 * siglens 카테고리 id를 core `NewsFeedCategory`로 넘기는 core 경계의 유일한 캐스트.
 *
 * core는 `general|stock|crypto|forex|articles`만 알고, siglens는 여기에 한국 증시
 * `'kr'`을 더해 쓴다(`NewsFeedCategoryId`).
 *
 * **왜 안전한가**: core 안에서 이 값이 닿는 곳은 네 군데인데(installed 0.47.0
 * `runMarketNewsDigest` 확인) 어느 것도 값으로 분기하거나 룩업하지 않고 전부 문자열로
 * 흘려보낸다.
 *   1. `createSkillSamplingPlan(..., ['market-news-digest', category, modelId, …])`
 *      — 샘플링 시드 성분
 *   2. `buildMarketNewsDigestCacheKey(category, …)` — Redis 키에 그대로 보간
 *   3. `correlationId: \`${category}:market-news-digest\`` — 로그 상관 id
 *   4. 빈 다이제스트 경고의 `console.warn` 페이로드
 * 프롬프트는 `categoryLabel`만 본다(`buildMarketNewsDigestPrompt` 확인). 따라서 `'kr'`은
 * `…:market-news:kr:…`이라는 **정확한** 네임스페이스를 만들고 다른 카테고리와 충돌하지
 * 않는다.
 *
 * core가 이 값으로 분기하기 시작하면 이 캐스트는 깨져야 한다 — union 확장은 core 후속
 * 과제다.
 */
export function toCoreFeedCategory(
    category: NewsFeedCategoryId
): NewsFeedCategory {
    // safe: 위 JSDoc — core는 이 값으로 분기하지 않고 문자열로만 흘려보낸다.
    return category as NewsFeedCategory;
}
