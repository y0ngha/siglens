'use server';

import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { logActionError } from '@/shared/lib/logActionError';
import { getMarketNewsCards } from '../api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import type { MarketNewsCardItem } from '../lib/toCardItem';

/**
 * {@link getMarketNewsCardsAction}의 결과. 던지는 대신 `ok: false`를 돌려줘, 클라이언트
 * 폴링 훅이 예외가 네트워크 경계를 넘지 않고 연속 실패 횟수를 셀 수 있게 하고 원시 DB
 * 오류가 클라이언트로 새지 않게 한다.
 */
export type GetMarketNewsCardsResult =
    | { ok: true; items: MarketNewsCardItem[] }
    | { ok: false; error: string };

/**
 * Server Action: 카테고리의 최신 시장 뉴스 카드 상태를 DB에서 읽는다.
 *
 * 클라이언트의 `useMarketNewsCardPolling`·`useWaitForMarketNewsCards`가 대기 중인 카드
 * (sentiment / priceImpact 없음)가 백그라운드 워커에 보강됐는지 확인하려고 부른다.
 * 최근 `attachAnalysis` 쓰기를 반영해야 하므로 의도적으로 캐시하지 않는다.
 *
 * `getMarketNewsCards`(React.cache)로 같은 RSC 렌더·Server Action 호출 안의 동시 호출을
 * 합친다. 투영은 읽기(`listCardsByCategory`)의 SELECT가 한다 — DB 내부 컬럼
 * (bodyEn, symbol, analyzedAt)은 애초에 조회되지 않으므로 응답에도 실리지 않는다.
 */
export async function getMarketNewsCardsAction(
    category: NewsFeedCategoryId
): Promise<GetMarketNewsCardsResult> {
    try {
        const { sentinel } = CATEGORY_CONFIG[category];
        // 카드 리더는 본문 컬럼을 아예 읽지 않는다 — 받은 뒤 거르면 Neon 전송이
        // 3초 폴링마다 그대로 난다.
        //
        // 행 수 상한도 같은 이유로 여기서 건다: 이 액션은 3초마다 호출되므로 화면이
        // 다루지 않는 행을 매 tick 실어 보내면 누적이 RSC 한 번보다 커지고,
        // `compress: true` 이후로는 그 응답이 매번 오리진에서 gzip된다.
        const items = await getMarketNewsCards(
            sentinel,
            await resolveRequestLocale()
        );
        return {
            ok: true,
            items:
                items.length > NEWS_ROW_SERIALIZATION_LIMIT
                    ? items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
                    : items,
        };
    } catch (error) {
        logActionError('[getMarketNewsCardsAction]', error);
        return { ok: false, error: 'db error' };
    }
}
