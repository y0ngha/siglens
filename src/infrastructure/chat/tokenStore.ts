import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

export const CHAT_TOKEN_LIMIT = 5;
export const CHAT_TOKEN_TTL_SEC = 86400; // 24시간

function getRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
}

export function hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex');
}

function buildKey(hashedIp: string): string {
    return `chat:tokens:${hashedIp}`;
}

export async function tryConsumeToken(hashedIp: string): Promise<boolean> {
    const redis = getRedis();
    if (redis === null) return true;

    const key = buildKey(hashedIp);

    try {
        const count = await redis.incr(key);
        await redis.expire(key, CHAT_TOKEN_TTL_SEC, 'NX');
        return count <= CHAT_TOKEN_LIMIT;
    } catch {
        return true;
    }
}

export async function getRemainingTokens(hashedIp: string): Promise<number> {
    const redis = getRedis();
    if (redis === null) return CHAT_TOKEN_LIMIT;

    const key = buildKey(hashedIp);

    try {
        const count = await redis.get<number>(key);
        if (count === null) return CHAT_TOKEN_LIMIT;
        return Math.max(0, CHAT_TOKEN_LIMIT - count);
    } catch {
        return CHAT_TOKEN_LIMIT;
    }
}
