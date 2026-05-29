const { mockRedisConstructor } = vi.hoisted(() => ({
    mockRedisConstructor: vi.fn(),
}));

// createPendingOAuthSignupStoreFromEnv builds a real `new Redis(...)` via the
// shared client; stub the constructor so the env-driven path is observable
// without a live Upstash connection. The direct-client tests below pass their
// own mock and never hit this constructor.
vi.mock('@upstash/redis', () => ({
    Redis: vi.fn().mockImplementation(function (opts: unknown) {
        mockRedisConstructor(opts);
        return { __opts: opts };
    }),
}));

import type { Mock } from 'vitest';
import {
    createPendingOAuthSignupStore,
    type PendingOAuthSignup,
} from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { __resetRedisClientForTests } from '@/shared/cache/redisClient';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';
import type { Redis } from '@upstash/redis';

describe('PendingOAuthSignupStore', () => {
    function makeRedis() {
        const store = new Map<string, string>();
        const client = {
            set: vi.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
            get: vi.fn(async (key: string) => store.get(key) ?? null),
            getdel: vi.fn(async (key: string) => {
                const value = store.get(key) ?? null;
                store.delete(key);
                return value;
            }),
            del: vi.fn(async (key: string) => {
                store.delete(key);
            }),
        };
        return { client: client as unknown as Redis, store };
    }

    const sample: PendingOAuthSignup = {
        provider: 'google',
        email: 'new@example.com',
        providerAccountId: 'gid_123',
        name: 'Hong Gildong',
        accessToken: 'at',
        next: '/',
        createdAt: new Date('2026-05-04T00:00:00Z').toISOString(),
    };

    it('save stores under the namespaced key with TTL', async () => {
        const { client } = makeRedis();
        const store = createPendingOAuthSignupStore(client);

        const token = await store.save(sample);

        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(client.set as Mock).toHaveBeenCalledWith(
            `pending_oauth_signup:${token}`,
            JSON.stringify(sample),
            expect.objectContaining({ ex: 10 * SECONDS_PER_MINUTE })
        );
    });

    it('peek returns stored profile without deleting', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client);
        const token = await sut.save(sample);

        const peeked = await sut.peek(token);

        expect(peeked).toEqual(sample);
        expect(store.has(`pending_oauth_signup:${token}`)).toBe(true);
    });

    it('consume returns and deletes', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client);
        const token = await sut.save(sample);

        const first = await sut.consume(token);
        const second = await sut.consume(token);

        expect(first).toEqual(sample);
        expect(second).toBeNull();
        expect(store.has(`pending_oauth_signup:${token}`)).toBe(false);
    });

    it('delete removes the entry', async () => {
        const { client, store } = makeRedis();
        const sut = createPendingOAuthSignupStore(client);
        const token = await sut.save(sample);

        await sut.delete(token);

        expect(store.has(`pending_oauth_signup:${token}`)).toBe(false);
    });

    it('peek returns null for nonexistent token', async () => {
        const { client } = makeRedis();
        const sut = createPendingOAuthSignupStore(client);

        expect(await sut.peek('nonexistent')).toBeNull();
    });

    it('peek returns null for corrupted (non-JSON) stored value', async () => {
        const { client } = makeRedis();
        (client.get as Mock).mockResolvedValueOnce('{{invalid-json}}');
        const sut = createPendingOAuthSignupStore(client);

        const result = await sut.peek('some-token');

        expect(result).toBeNull();
    });

    it('tryParse handles already-deserialized object from Upstash (auto-deserialization)', async () => {
        const { client } = makeRedis();
        // Upstash may auto-deserialize JSON into an object instead of returning a string
        (client.get as Mock).mockResolvedValueOnce(sample);
        const sut = createPendingOAuthSignupStore(client);

        const result = await sut.peek('some-token');

        expect(result).toEqual(sample);
    });

    it('tryParse returns null for non-string, non-object value (e.g. number)', async () => {
        const { client } = makeRedis();
        (client.get as Mock).mockResolvedValueOnce(42);
        const sut = createPendingOAuthSignupStore(client);

        const result = await sut.peek('some-token');

        expect(result).toBeNull();
    });

    it('consume returns null for corrupted stored value', async () => {
        const { client } = makeRedis();
        (client.getdel as Mock).mockResolvedValueOnce('not valid json {{');
        const sut = createPendingOAuthSignupStore(client);

        const result = await sut.consume('some-token');

        expect(result).toBeNull();
    });

    it('consume handles already-deserialized object from Upstash', async () => {
        const { client } = makeRedis();
        (client.getdel as Mock).mockResolvedValueOnce(sample);
        const sut = createPendingOAuthSignupStore(client);

        const result = await sut.consume('some-token');

        expect(result).toEqual(sample);
    });
});

describe('createPendingOAuthSignupStoreFromEnv', () => {
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    beforeEach(() => {
        // The shared Redis client is a module-level singleton. Without a reset,
        // the first test's null result would be cached and later tests would
        // pass against that cache instead of their own env — masking real
        // behavior (and never exercising the non-null construction path).
        __resetRedisClientForTests();
        mockRedisConstructor.mockClear();
    });

    afterEach(() => {
        __resetRedisClientForTests();
        if (originalUrl !== undefined) {
            process.env.UPSTASH_REDIS_REST_URL = originalUrl;
        } else {
            delete process.env.UPSTASH_REDIS_REST_URL;
        }
        if (originalToken !== undefined) {
            process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
        } else {
            delete process.env.UPSTASH_REDIS_REST_TOKEN;
        }
    });

    it('returns a store and constructs the client once when both env vars are set', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

        const { createPendingOAuthSignupStoreFromEnv } =
            await import('@/entities/oauth-account/lib/pendingOAuthSignupStore');
        const store = createPendingOAuthSignupStoreFromEnv();

        expect(store).not.toBeNull();
        expect(typeof store?.save).toBe('function');
        expect(typeof store?.consume).toBe('function');
        expect(mockRedisConstructor).toHaveBeenCalledTimes(1);
        expect(mockRedisConstructor).toHaveBeenCalledWith({
            url: 'https://redis.upstash.io',
            token: 'token',
        });
    });

    it('returns null when UPSTASH_REDIS_REST_URL is not set', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

        const { createPendingOAuthSignupStoreFromEnv } =
            await import('@/entities/oauth-account/lib/pendingOAuthSignupStore');
        const store = createPendingOAuthSignupStoreFromEnv();

        expect(store).toBeNull();
    });

    it('returns null when UPSTASH_REDIS_REST_TOKEN is not set', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        const { createPendingOAuthSignupStoreFromEnv } =
            await import('@/entities/oauth-account/lib/pendingOAuthSignupStore');
        const store = createPendingOAuthSignupStoreFromEnv();

        expect(store).toBeNull();
    });
});
