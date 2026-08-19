import type { NewsDisplayItem } from '@/shared/lib/types';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '../constants';

/**
 * 폴링이 돌려준 목록을 서버가 넘겨준 것과 **같은 상한**으로 맞춘다.
 *
 * 서버 섹션과 폴링 액션(`getNewsCardsAction`)이 모두 같은 상한을 쓰지만, 여기서 한 번
 * 더 맞춰 둔다 — 액션이 상한을 잃거나 상한이 다른 경로가 생기면 아래 두 가지가
 * 곧바로 되살아난다(예전에 실제로 그랬다: 액션이 전량 1,417행을 돌려주던 시절):
 *
 *  1. **무효화 기준선 오염** — 기준선은 상한 걸린 목록에서 세고 비교 대상은 전량이라,
 *     보강이 하나도 진행되지 않아도 `전량의 enriched > 상한의 enriched`가 거의 항상
 *     참이 된다. 그러면 방문마다 `newsAnalysis` 쿼리가 무효화되고, 그 쿼리는
 *     `staleTime: Infinity`라 무효화가 유일한 재요청 트리거이므로 집계 AI 분석이
 *     매번 다시 돌았다.
 *  2. **"더보기" 잔여 개수 점프** — 첫 페인트의 `45개 남음`이 첫 폴링 후 `1412개 남음`으로
 *     튀었다.
 *
 * 화면이 다루는 행 수를 한쪽에서만 제한할 이유가 없다 — 양쪽 모두 같은 상한을 쓴다.
 * 두 목록 다 최신순이라 앞에서 자르면 새로 들어온 기사가 남는다.
 */
export function capRows(items: NewsDisplayItem[]): NewsDisplayItem[] {
    return items.length > NEWS_ROW_SERIALIZATION_LIMIT
        ? items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
        : items;
}
