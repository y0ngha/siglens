/** 만료 시각이 현재와 같거나 이전이면 만료다(경계 포함). 조회 경로가 `expired` 상태를 가를 때 쓴다. */
export function isExpired(expiresAt: Date, now: Date): boolean {
    return expiresAt.getTime() <= now.getTime();
}
