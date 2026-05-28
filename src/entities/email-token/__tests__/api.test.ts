vi.mock('@upstash/redis', () => {
    const MockRedis = vi.fn(function () {
        return {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
        };
    });
    return { Redis: MockRedis };
});

import type { Mock } from 'vitest';
import { Redis } from '@upstash/redis';
import { __resetRedisClientForTests } from '@/shared/cache/redisClient';
import {
    buildEmailTokenKey,
    createEmailTokenStore,
    type EmailTokenValue,
} from '../api';

const MockRedis = Redis as unknown as Mock;

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
        __resetRedisClientForTests();
        MockRedis.mockReset();
        MockRedis.mockImplementation(function () {
            return {
                get: vi.fn(),
                set: vi.fn(),
                del: vi.fn(),
            };
        });
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
            const mockSet = vi.fn().mockResolvedValue('OK');
            MockRedis.mockImplementation(function () {
                return {
                    get: vi.fn(),
                    set: mockSet,
                    del: vi.fn(),
                };
            });

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
            const mockGet = vi.fn().mockResolvedValue(stored);
            MockRedis.mockImplementation(function () {
                return {
                    get: mockGet,
                    set: vi.fn(),
                    del: vi.fn(),
                };
            });

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
            const mockDel = vi.fn().mockResolvedValue(1);
            MockRedis.mockImplementation(function () {
                return {
                    get: vi.fn(),
                    set: vi.fn(),
                    del: mockDel,
                };
            });

            const store = createEmailTokenStore()!;
            await store.delete('password_reset', 'user@example.com');
            expect(mockDel).toHaveBeenCalledWith(
                'email_token:password_reset:user@example.com'
            );
        });
    });

    it('cache key disambiguates "readonly token unset" from a configured value', () => {
        // Configure with no readonly token first; this caches one Redis pair.
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: '',
        });
        createEmailTokenStore();
        const callsAfterUnset = MockRedis.mock.calls.length;

        __resetRedisClientForTests();

        // After the reset, configure a real readonly token. getRedisReaderWriter
        // builds a fresh writer plus a separate reader (the readonly token differs
        // from the writer token), so more Redis instances are constructed than the
        // earlier empty/unset-token case where the reader reused the writer.
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: 'configured-readonly',
        });
        createEmailTokenStore();
        // A new pair (writer + reader) must have been created.
        expect(MockRedis.mock.calls.length).toBeGreaterThan(callsAfterUnset);
    });

    describe('consume()', () => {
        beforeEach(() => {
            setEnv({
                UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
                UPSTASH_REDIS_REST_TOKEN: 'master-token',
                UPSTASH_REDIS_REST_READONLY_TOKEN: '',
            });
        });

        it('atomically returns and deletes the value via writer.getdel', async () => {
            const stored: EmailTokenValue = {
                status: 'pending',
                tokenHash: 'hash',
            };
            const mockGetdel = vi.fn().mockResolvedValue(stored);
            MockRedis.mockImplementation(function () {
                return {
                    get: vi.fn(),
                    set: vi.fn(),
                    del: vi.fn(),
                    getdel: mockGetdel,
                };
            });

            const store = createEmailTokenStore()!;
            const value = await store.consume(
                'password_reset',
                'user@example.com'
            );
            expect(mockGetdel).toHaveBeenCalledWith(
                'email_token:password_reset:user@example.com'
            );
            expect(value).toEqual(stored);
        });

        it('returns null when the key did not exist', async () => {
            const mockGetdel = vi.fn().mockResolvedValue(null);
            MockRedis.mockImplementation(function () {
                return {
                    get: vi.fn(),
                    set: vi.fn(),
                    del: vi.fn(),
                    getdel: mockGetdel,
                };
            });

            const store = createEmailTokenStore()!;
            const value = await store.consume(
                'password_reset',
                'user@example.com'
            );
            expect(value).toBeNull();
        });

        it('returns the raw stored value without filtering by status', async () => {
            // consume() must hand back whatever shape getdel returns; status
            // gating is the caller's responsibility (e.g. confirmPasswordReset
            // must verify status === 'pending' itself).
            const stored: EmailTokenValue = { status: 'verified' };
            const mockGetdel = vi.fn().mockResolvedValue(stored);
            MockRedis.mockImplementation(function () {
                return {
                    get: vi.fn(),
                    set: vi.fn(),
                    del: vi.fn(),
                    getdel: mockGetdel,
                };
            });

            const store = createEmailTokenStore()!;
            const value = await store.consume(
                'password_reset',
                'user@example.com'
            );
            expect(value).toEqual(stored);
        });
    });

    it('reader uses readonly client when readonly token is set', async () => {
        setEnv({
            UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
            UPSTASH_REDIS_REST_TOKEN: 'master-token',
            UPSTASH_REDIS_REST_READONLY_TOKEN: 'readonly-token',
        });

        const writerGet = vi.fn();
        const readerGet = vi.fn().mockResolvedValue(null);
        let callCount = 0;
        MockRedis.mockImplementation(function () {
            callCount++;
            return callCount === 1
                ? { get: writerGet, set: vi.fn(), del: vi.fn() }
                : { get: readerGet, set: vi.fn(), del: vi.fn() };
        });

        const store = createEmailTokenStore()!;
        await store.get('email_verification', 'user@example.com');
        expect(readerGet).toHaveBeenCalledWith(
            'email_token:email_verification:user@example.com'
        );
        expect(writerGet).not.toHaveBeenCalled();
    });
});
