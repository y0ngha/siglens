/**
 * 보강(AI 분석) 완료 카드 id 집합 계산 — 폴링 종료 시 집계 분석을 다시 돌릴지 판단하는 근거다.
 */
import { isCardPending } from '@/entities/news-article/lib/cardPollDecision';
import type { NewsDisplayItem } from '@/shared/lib/types';

/**
 * 보강이 끝난 카드의 id 집합. 대기 판정은 엔티티의 `isCardPending` 한 곳을 쓴다.
 */
export function collectEnrichedCardIds(
    items: readonly NewsDisplayItem[]
): ReadonlySet<string> {
    return new Set(
        items.filter(item => !isCardPending(item)).map(item => item.id)
    );
}

/**
 * `items`에 기준선에 없던 보강 카드가 있는가 — 개수가 아니라 **id**로 비교한다. 상한이 찬 목록에서는
 * 새 보강 행이 오래된 보강 행을 상한 밖으로 밀어 내 개수가 그대로여도 집계 분석은 낡은 것이다.
 */
export function hasNewEnrichedCard(
    baseline: ReadonlySet<string>,
    items: readonly NewsDisplayItem[]
): boolean {
    return [...collectEnrichedCardIds(items)].some(id => !baseline.has(id));
}
