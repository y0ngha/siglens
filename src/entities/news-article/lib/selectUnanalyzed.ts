import type { NewsItem } from '@y0ngha/siglens-core';

/** `selectUnanalyzed`가 필요로 하는 DB 행의 최소 형상. */
interface AnalyzableRow {
    id: string;
    analyzedAt: Date | string | null;
}

/**
 * 방금 fetch한 기사 중 **아직 보강되지 않았고 DB에도 실제로 있는** 것만 고른다.
 *
 * 두 조건 모두 비자명해서 한 곳에 모은다:
 *
 * 1. **`fresh`는 델타가 아니다.** `fetchNewsForPeriod`는 조회 창 **전체**를 매번
 *    돌려주므로, 그대로 보강에 넘기면 이미 라벨이 달린 기사를 다시 LLM에 태운다.
 *    프로덕션 데이터로 직접 호출해 잡았다 — 신규 0건인 심볼에서 17건이 재분석됐다.
 * 2. **`fresh`에 있다고 DB에 있는 건 아니다.** `ingestNewsForSymbol`은 과반 미만의
 *    upsert 실패를 삼키고 진행하므로, 존재하지 않는 id를 분석하면 LLM 비용을 쓰고
 *    no-op update를 날린다.
 *
 * 최신순으로 정렬해서 돌려준다 — 호출부가 상한으로 자를 때 잘리는 쪽이 오래된
 * 기사가 되도록.
 */
export function selectUnanalyzed(
    fresh: readonly NewsItem[],
    rows: readonly AnalyzableRow[]
): NewsItem[] {
    const rowIds = new Set(rows.map(r => r.id));
    const analyzedIds = new Set(
        rows.filter(r => r.analyzedAt !== null).map(r => r.id)
    );
    return fresh
        .filter(item => rowIds.has(item.id) && !analyzedIds.has(item.id))
        .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
