'use server';

import { ingestMarketNewsCategory } from '../api/ingestMarketNewsCategory';
import type { NewsFeedCategoryId } from '../lib/categoryConfig';

/**
 * Server Action: `category`의 새 시장 뉴스를 받아(소스는 카테고리가 정한다 — 미국·암호화폐는
 * FMP, 한국은 네이버) `market_news`에 upsert하고, 미보강 기사의 카드 AI 분석을 건다.
 *
 * 종목 단위 대응물과 달리 티어/BYOK 게이트가 없다 — 카테고리 다이제스트는 공개다.
 * 본문은 `ingestMarketNewsCategory`에 있다 — 허브 프리웜 크론이 같은 적재를 방문과
 * 무관하게 돌리므로 한 곳에 둔다. 방문자 경로는 보강 상한을 두지 않고, 크론만 유닛
 * 상한 때문에 건다.
 *
 * `waitUntil` 안에서 돌려 응답 스트림을 막지 않게 설계했다. 던지지 않는다 — 실패는
 * 로그로만 남는다.
 */
export async function ensureMarketNewsCardsAnalyzedAction(
    category: NewsFeedCategoryId
): Promise<void> {
    try {
        await ingestMarketNewsCategory(category, {
            logLabel: 'ensureMarketNewsCardsAnalyzedAction',
        });
    } catch (error) {
        console.error('[ensureMarketNewsCardsAnalyzedAction]', error);
    }
}
