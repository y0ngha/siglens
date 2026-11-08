import { getRedisReaderWriter } from '@/shared/cache/redisClient';

interface FixedWindowRateLimitOptions {
    /** 호출자가 조립한 Redis 키 전체(접두사 포함). */
    readonly key: string;
    /** 창 하나에서 허용하는 최대 횟수. */
    readonly limit: number;
    /** 창 길이(초). 첫 요청이 TTL로 건다. */
    readonly windowSeconds: number;
    /** fail-open 로그에 붙는 호출자 이름(예: `checkShareRateLimit`). */
    readonly logTag: string;
}

/**
 * 고정 창 방식의 횟수 제한. 공유 생성·피드백·문의 제한이 같은 구현을 쓴다.
 *
 * Redis 미설정(`getRedisReaderWriter() === null`) 또는 오류 시 통과(fail-open)한다 - Redis 장애
 * 한 번이 모든 제출을 막지 않게 하려는 것이다.
 *
 * 원자성: SET NX EX로 첫 요청이 키 생성과 만료 설정을 한 번에 한다. INCR+EXPIRE를 나누면 INCR
 * 직후 프로세스가 죽을 때 만료 없는 키가 남아 영구 잠금이 된다.
 * - 첫 요청: SET NX EX 성공(OK) -> count 1로 간주, 허용
 * - 이후 요청: SET NX EX가 null(이미 존재) -> INCR로 증분 후 비교
 *
 * @returns true = 허용, false = 차단(한도 초과)
 */
export async function checkFixedWindowRateLimit({
    key,
    limit,
    windowSeconds,
    logTag,
}: FixedWindowRateLimitOptions): Promise<boolean> {
    const pair = getRedisReaderWriter();
    if (!pair) return true;

    try {
        const setResult = await pair.writer.set(key, 1, {
            nx: true,
            ex: windowSeconds,
        });
        if (setResult !== null) return true;
        const count = await pair.writer.incr(key);
        return count <= limit;
    } catch (err) {
        console.error(`[${logTag}] redis error, failing open`, err);
        return true;
    }
}
