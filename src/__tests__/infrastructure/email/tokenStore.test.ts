jest.mock('@upstash/redis', () => {
    const MockRedis = jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    }));
    return { Redis: MockRedis };
});

import { Redis } from '@upstash/redis';
import {
    __resetEmailTokenStoreCacheForTests,
    buildEmailTokenKey,
    createEmailTokenStore,
    type EmailTokenValue,
} from '@/infrastructure/email/tokenStore';

const MockRedis = Redis as unknown as jest.Mock;

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
        if (value === '') {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

describe('buildEmailTokenKey', () => {
    it('namespaces password reset and email verification keys separately', () => {
        const email = 'user@example.com';
        expect(buildEmailTokenKey('password_reset', email)).toBe(
            'email_token:password_reset:user@example.com'
        );
        expect(buildEmailTokenKey('email_verification', email)).toBe(
            'email_token:email_verification:user@example.com'
        );
    });
});

describe('createEmailTokenStore', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;
        delete process.env.UPSTASH_REDIS_REST_READONLY_TOKEN;
        __resetEmailTokenStoreCacheForTests();
        MockRedis.mockReset();
        MockRedis.mockImplementation(() => ({
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
        }));
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('returns null when UPSTASH_REDIS_REST_URL is missing', () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: '',
            UPSTASH_REDIS_REST_TOKEN: 'token',
        });
        expect(createEmailTokenStore()).toBeNull();
    });

    it('returns null when UPSTASH_REDIS_REST_TOKEN is missing', () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: '',
        });
        expect(createEmailTokenStore()).toBeNull();
    });

    it('returns an EmailTokenStore when env vars are present (no readonly token)', () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: '',
        });
        const store = createEmailTokenStore();
        expect(store).not.toBeNull();
        expect(MockRedis).toHaveBeenCalledTimes(1);
    });

    it('creates a separate reader when readonly token is provided', () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: 'readonly-token',
        });
        const store = createEmailTokenStore();
        expect(store).not.toBeNull();
        expect(MockRedis).toHaveBeenCalledTimes(2);
    });

    it('reuses Redis clients for repeated calls with the same configuration', () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: 'readonly-token',
        });

        const first = createEmailTokenStore();
        const second = createEmailTokenStore();

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(MockRedis).toHaveBeenCalledTimes(2);
    });

    describe('when env vars are present (no readonly token)', () => {
        beforeEach(() => {
            setEnv({
                UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
                UPSTASH_REDIS_REST_TOKEN: 'master-token',
                UPSTASH_REDIS_REST_READONLY_TOKEN: '',
            });
        });

        it('set delegates to writer.set with the namespaced key, value, and TTL', async () => {
            const mockSet = jest.fn().mockResolvedValue('OK');
            MockRedis.mockImplementation(() => ({
                get: jest.fn(),
                set: mockSet,
                del: jest.fn(),
            }));

            const store = createEmailTokenStore()!;
            const value: EmailTokenValue = {
                status: 'pending',
                tokenHash: 'hash',
            };
            await store.set(
                'email_verification',
                'user@example.com',
                value,
                1800
            );
            expect(mockSet).toHaveBeenCalledWith(
                'email_token:email_verification:user@example.com',
                value,
                { ex: 1800 }
            );
        });

        it('get delegates to reader.get with the namespaced key', async () => {
            const stored: EmailTokenValue = { status: 'verified' };
            const mockGet = jest.fn().mockResolvedValue(stored);
            MockRedis.mockImplementation(() => ({
                get: mockGet,
                set: jest.fn(),
                del: jest.fn(),
            }));

            const store = createEmailTokenStore()!;
            const result = await store.get(
                'email_verification',
                'user@example.com'
            );
            expect(mockGet).toHaveBeenCalledWith(
                'email_token:email_verification:user@example.com'
            );
            expect(result).toEqual(stored);
        });

        it('delete delegates to writer.del with the namespaced key', async () => {
            const mockDel = jest.fn().mockResolvedValue(1);
            MockRedis.mockImplementation(() => ({
                get: jest.fn(),
                set: jest.fn(),
                del: mockDel,
            }));

            const store = createEmailTokenStore()!;
            await store.delete('password_reset', 'user@example.com');
            expect(mockDel).toHaveBeenCalledWith(
                'email_token:password_reset:user@example.com'
            );
        });
    });

    it('reader uses readonly client when readonly token is set', async () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: 'readonly-token',
        });

        const writerGet = jest.fn();
        const readerGet = jest.fn().mockResolvedValue(null);
        let callCount = 0;
        MockRedis.mockImplementation(() => {
            callCount++;
            return callCount === 1
                ? { get: writerGet, set: jest.fn(), del: jest.fn() }
                : { get: readerGet, set: jest.fn(), del: jest.fn() };
        });

        const store = createEmailTokenStore()!;
        await store.get('email_verification', 'user@example.com');
        expect(readerGet).toHaveBeenCalledWith(
            'email_token:email_verification:user@example.com'
        );
        expect(writerGet).not.toHaveBeenCalled();
    });
});
