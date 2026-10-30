import type { QueryKey } from '@tanstack/react-query';

/**
 * 다이제스트 대기 폴러의 쿼리 키.
 *
 * 첫 시도(`attempt === 0`)는 목록 폴러와 같은 키를 써서 요청을 나눠 쓴다. 재시도부터는 시도
 * 번호를 키에 붙인다 — 폴러는 쿼리 키가 바뀌어야 종료 상태와 시작 시각을 새로 시작하므로,
 * 키를 바꾸는 것이 대기를 처음부터 다시 돌리는 방법이다.
 */
export function marketNewsCardsWaitKey(
    baseKey: QueryKey,
    attempt: number
): QueryKey {
    return attempt === 0 ? baseKey : [...baseKey, 'retry', attempt];
}
