/**
 * `run(input)`의 결과를 돌려주고, reject하면 `null`을 돌려준다.
 *
 * 보유종목 저장·삭제 액션은 자기 DB 오류만 `status: 'error'` 결과로 바꾸고, 세션 조회 실패나 RSC
 * 전송 실패는 그대로 reject한다. 폼과 행이 그 경우를 "일반 오류 문구"로 처리하면서 진행 중
 * 상태에 잠기지 않도록 실패를 값으로 바꾼다. 훅 본문에 try/finally를 두지 않으려고
 * (REACT.md#EF-3) 모듈 함수로 둔다.
 */
export async function resolveOrNull<TInput, TResult>(
    run: (input: TInput) => Promise<TResult>,
    input: TInput
): Promise<TResult | null> {
    try {
        return await run(input);
    } catch {
        return null;
    }
}
