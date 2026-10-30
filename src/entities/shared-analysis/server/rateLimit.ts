import { getRedisReaderWriter } from '@/shared/cache/redisClient';

const SHARE_LIMIT_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/**
 * IP 해시당 시간당 공유 생성 횟수를 제한한다. `createShareSnapshotAction`이 쓴다.
 * Redis 미설정(getRedisReaderWriter() === null) 또는 Redis 오류 시 통과(fail-open)한다 —
 * Redis 장애 한 번이 모든 공유 생성을 막지 않도록 하기 위해서다.
 *
 * 원자성: SET NX EX로 첫 요청이 키 생성과 만료 설정을 한 번에 한다.
 * INCR+EXPIRE를 나누면 INCR 직후 프로세스가 죽을 때 만료 없는 키가 남아 영구 잠금이 된다.
 * - 첫 요청: SET NX EX 성공(OK) → count 1로 간주, 허용
 * - 이후 요청: SET NX EX가 null(이미 존재) → INCR로 증분 후 비교
 *
 * @returns true = 허용, false = 차단(rate limit 초과)
 */
export async function checkShareRateLimit(ipHash: string): Promise<boolean> {
    const pair = getRedisReaderWriter();
    if (!pair) return true;

    const key = `share:rl:${ipHash}`;
    try {
        const setResult = await pair.writer.set(key, 1, {
            nx: true,
            ex: WINDOW_SECONDS,
        });
        if (setResult !== null) return true;
        const count = await pair.writer.incr(key);
        return count <= SHARE_LIMIT_PER_HOUR;
    } catch (err) {
        console.error('[checkShareRateLimit] redis error, failing open', err);
        return true;
    }
}
