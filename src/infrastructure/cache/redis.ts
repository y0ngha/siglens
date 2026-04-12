import { Redis } from '@upstash/redis';
import type { CacheProvider } from '@/infrastructure/cache/types';

export function createCacheProvider(): CacheProvider | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const masterToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !masterToken) {
        return null;
    }

    const readonlyToken = process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;

    const writer = new Redis({
        url,
        token: masterToken,
    });

    const reader = readonlyToken
        ? new Redis({
              url,
              token: readonlyToken,
          })
        : writer;

    return {
        async get<T>(key: string): Promise<T | null> {
            return reader.get<T>(key);
        },
        async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
            await writer.set(key, value, { ex: ttlSeconds });
        },
        async delete(key: string): Promise<void> {
            await writer.del(key);
        },
    };
}
