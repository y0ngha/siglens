import { getRedisReaderWriter } from '@/shared/cache/redisClient';

const SHARE_LIMIT_PER_HOUR = 30;
const WINDOW_SECONDS = 3600;

/**
 * IP 해시당 시간당 공유 생성 횟수를 제한한다.
 * Redis 미설정(getRedisReaderWriter() === null) 또는 Redis 오류 시 통과(fail-open).
 *
 * 원자성 보장: SET NX EX로 첫 요청을 원자적으로 키 생성+만료 설정한다.
 * 기존 INCR+EXPIRE 분리 패턴은 INCR 직후 프로세스가 종료되면 키가 만료 없이
 * 영구 잠금 상태가 될 수 있는 취약점이 있다.
 * - 첫 요청: SET NX EX → 성공(OK) → count 1로 간주, 허용
 * - 이후 요청: SET NX EX → null(이미 존재) → INCR로 증분 후 비교
 *
 * @returns true = 허용, false = 차단(rate limit 초과)
 */
export async function checkShareRateLimit(ipHash: string): Promise<boolean> {
    const pair = getRedisReaderWriter();
    if (!pair) return true;

    const key = `share:rl:${ipHash}`;
    try {
        // Atomically set the key with expiry only if it doesn't exist yet (NX).
        // Returns "OK" on first request (key created), null if key already exists.
        const setResult = await pair.writer.set(key, 1, {
            nx: true,
            ex: WINDOW_SECONDS,
        });
        if (setResult !== null) {
            // First request in the window — count is 1, always under the limit.
            return true;
        }
        // Key already exists: increment and check the count.
        const count = await pair.writer.incr(key);
        return count <= SHARE_LIMIT_PER_HOUR;
    } catch (err) {
        // Redis is configured but currently unreachable — fail-open so a transient
        // Redis outage does not block all share creation.
        console.error('[checkShareRateLimit] redis error, failing open', err);
        return true;
    }
}
