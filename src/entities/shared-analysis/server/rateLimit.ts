import { getRedisReaderWriter } from '@/shared/cache/redisClient';

const SHARE_LIMIT_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/**
 * IP 해시당 시간당 공유 생성 횟수를 제한한다.
 * Redis 미설정(getRedisReaderWriter() === null) 또는 Redis 오류 시 통과(fail-open).
 *
 * @returns true = 허용, false = 차단(rate limit 초과)
 */
export async function checkShareRateLimit(ipHash: string): Promise<boolean> {
    const pair = getRedisReaderWriter();
    if (!pair) return true;

    const key = `share:rl:${ipHash}`;
    const count = await pair.writer.incr(key);
    if (count === 1) await pair.writer.expire(key, WINDOW_SECONDS);
    return count <= SHARE_LIMIT_PER_HOUR;
}
