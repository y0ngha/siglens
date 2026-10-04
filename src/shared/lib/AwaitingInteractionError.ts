/**
 * AI 자동 실행 게이트가 막은 상태에서 캐시 전용 조회가 미스(`miss_no_trigger`)일 때
 * 쿼리 함수가 던지는 센티넬. 탭 훅이 이것을 `awaiting_interaction` 상태로 바꾼다.
 *
 * 오류가 아니다 — "아직 아무도 이 종목의 분석을 요청하지 않았다"는 뜻이고, 사용자가
 * 입력하면(`useAiAutoRunAllowed`) `useRefetchWhenAllowed`가 일반 요청으로 다시 부른다.
 * React Query 쿼리 함수는 데이터를 돌려주거나 던지는 것만 할 수 있어 던지는 쪽을 쓴다
 * (가짜 응답 객체로 캐시를 오염시키지 않으려고). `CacheOnlyMissError`(옵션 탭의 OI
 * stale 캐시 전용 조회)와는 이유가 달라 따로 둔다 — 그쪽은 입력해도 생성하지 않는다.
 */
export class AwaitingInteractionError extends Error {
    readonly isAwaitingInteraction = true as const;
    constructor() {
        super('awaiting_interaction');
        this.name = 'AwaitingInteractionError';
    }
}
