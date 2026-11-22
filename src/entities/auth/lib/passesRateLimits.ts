import type { AuthRateLimiter } from './authUseCaseTypes';

/**
 * 규칙을 **순서대로** 하나씩 세고 첫 거부에서 멈춘다(`false`). 순서가 보안이다: 막힌 IP가 주소의 칸을
 * 소모하지 않게 IP 규칙을 앞에 둔다. 순차 await가 의도라 병렬화하지 않는다.
 */
export async function passesRateLimits(
    rateLimit: AuthRateLimiter,
    rules: readonly Parameters<AuthRateLimiter>[0][]
): Promise<boolean> {
    for (const rule of rules) {
        if (!(await rateLimit(rule))) {
            return false;
        }
    }
    return true;
}
