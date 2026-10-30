/**
 * 클라이언트로 나가는 결과에서 `unfilteredResult`를 뺀 사본을 만든다.
 *
 * core의 `done` 결과는 이력 저장용으로 **tier 필터 전** 분석(`unfilteredResult`)을 함께 싣는다.
 * 이 값이 SSE 본문으로 직렬화되면 free 비회원도 진입가·손절·목표가·확신도를 응답 JSON에서 그대로
 * 읽는다 — 화면의 잠금이 무의미해진다. 이력 저장 구독자는 원본을 읽으므로(`result.unfilteredResult`)
 * 이 함수는 **클라이언트 쪽 가지**에만 건다. 다른 분석 타입 결과에는 이 필드가 없어 그대로 통과한다.
 */
export function omitUnfiltered<T extends object>(
    result: T
): Omit<T, 'unfilteredResult'> {
    // 캐스트 근거: `unfilteredResult`는 core가 technical `done` 결과에만 붙이는 선택 필드다.
    // 다른 결과 타입에는 없으므로 구조 분해에서 `undefined`로 빠질 뿐 나머지는 그대로다.
    const { unfilteredResult: _unfiltered, ...rest } = result as T & {
        unfilteredResult?: unknown;
    };
    return rest;
}
