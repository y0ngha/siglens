import { Redis } from '@upstash/redis';

/**
 * Job 전용 raw Redis 클라이언트 팩토리.
 * CacheProvider(get/set/delete)로는 커버되지 않는 TTL 조합 SET 등
 * job 관련 저수준 Redis 명령에 사용한다.
 */
export function createJobRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return null;
    }

    return new Redis({ url, token });
}
