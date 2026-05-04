import {
    createPendingOAuthSignupStore,
    type PendingOAuthSignup,
} from '@/infrastructure/auth/pendingOAuthSignupStore';
import type { Redis } from '@upstash/redis';

describe('PendingOAuthSignupStore', () => {
    function makeRedis() {
        const store = new Map<string, string>();
        const client = {
            set: jest.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
            get: jest.fn(async (key: string) => store.get(key) ?? null),
            getdel: jest.fn(async (key: string) => {
                const value = store.get(key) ?? null;
                store.delete(key);
                return value;
            }),
            del: jest.fn(async (key: string) => {
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
        expect(client.set as jest.Mock).toHaveBeenCalledWith(
            `pending_oauth_signup:${token}`,
            JSON.stringify(sample),
            expect.objectContaining({ ex: 600 })
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
});
