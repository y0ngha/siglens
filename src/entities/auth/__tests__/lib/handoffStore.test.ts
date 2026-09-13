import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redis, client } = vi.hoisted(() => {
    const redis = { set: vi.fn(), getdel: vi.fn() };
    return { redis, client: { current: redis as typeof redis | null } };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => client.current,
}));

import {
    consumeHandoffCode,
    generateHandoffToken,
    HANDOFF_STATE_TTL_SECONDS,
    handoffStateCookie,
    handoffStateCookieName,
    isHandoffToken,
    issueHandoffCode,
} from '@/entities/auth/lib/handoffStore';

const STATE = 'b'.repeat(64);
const CODE = 'a'.repeat(64);

describe('handoffStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        client.current = redis;
    });

    describe('issueHandoffCode', () => {
        it('stores {userId, path-only next, state} under a 64-hex code with a 60s TTL', async () => {
            redis.set.mockResolvedValue('OK');
            const code = await issueHandoffCode({
                userId: 'u1',
                next: 'https://evil.com/x',
                state: STATE,
            });
            expect(code).toMatch(/^[0-9a-f]{64}$/);
            expect(redis.set).toHaveBeenCalledWith(
                `auth:handoff:${code}`,
                JSON.stringify({ userId: 'u1', next: '/', state: STATE }),
                { ex: 60 }
            );
        });

        it('issues a different code each time', async () => {
            redis.set.mockResolvedValue('OK');
            const input = { userId: 'u1', next: '/', state: STATE };
            expect(await issueHandoffCode(input)).not.toBe(
                await issueHandoffCode(input)
            );
        });

        it('throws when Redis is not configured', async () => {
            client.current = null;
            await expect(
                issueHandoffCode({ userId: 'u1', next: '/', state: STATE })
            ).rejects.toThrow('[handoff] redis unavailable');
        });

        it('throws when the write is not acknowledged', async () => {
            redis.set.mockResolvedValue(null);
            await expect(
                issueHandoffCode({ userId: 'u1', next: '/', state: STATE })
            ).rejects.toThrow('[handoff] code not stored');
        });
    });

    describe('consumeHandoffCode', () => {
        it('getdels once and returns the payload when the state matches (auto-deserialized object)', async () => {
            redis.getdel.mockResolvedValueOnce({
                userId: 'u1',
                next: '/c/abc',
                state: STATE,
            });
            expect(await consumeHandoffCode(CODE, STATE)).toEqual({
                userId: 'u1',
                next: '/c/abc',
            });
            expect(redis.getdel).toHaveBeenCalledTimes(1);
            expect(redis.getdel).toHaveBeenCalledWith(`auth:handoff:${CODE}`);
        });

        it('parses a raw JSON string payload', async () => {
            redis.getdel.mockResolvedValueOnce(
                JSON.stringify({ userId: 'u1', next: '/c/abc', state: STATE })
            );
            expect(await consumeHandoffCode(CODE, STATE)).toEqual({
                userId: 'u1',
                next: '/c/abc',
            });
        });

        it('returns null for a state mismatch (login CSRF) — the code is still burned', async () => {
            redis.getdel.mockResolvedValueOnce({
                userId: 'attacker',
                next: '/',
                state: 'c'.repeat(64),
            });
            expect(await consumeHandoffCode(CODE, STATE)).toBeNull();
            expect(redis.getdel).toHaveBeenCalledTimes(1);
        });

        it('re-sanitizes a stored next that is not a path', async () => {
            redis.getdel.mockResolvedValueOnce({
                userId: 'u1',
                next: '//evil.com',
                state: STATE,
            });
            expect(await consumeHandoffCode(CODE, STATE)).toEqual({
                userId: 'u1',
                next: '/',
            });
        });

        it.each([
            ['missing', null],
            ['broken JSON', '{bad'],
            ['non-object JSON', '42'],
            ['missing fields', { userId: 'u1', next: '/' }],
            ['malformed stored state', { userId: 'u1', next: '/', state: 'x' }],
        ])('returns null for a %s payload', async (_label, raw) => {
            redis.getdel.mockResolvedValueOnce(raw);
            expect(await consumeHandoffCode(CODE, STATE)).toBeNull();
        });

        it.each([
            ['short code', 'short', STATE],
            ['uppercase code', 'A'.repeat(64), STATE],
            ['null code', null, STATE],
            ['missing state', CODE, undefined],
            ['malformed state', CODE, 'nope'],
        ])('never calls Redis for a %s', async (_label, code, state) => {
            expect(await consumeHandoffCode(code, state)).toBeNull();
            expect(redis.getdel).not.toHaveBeenCalled();
        });

        it('returns null when Redis is not configured', async () => {
            client.current = null;
            expect(await consumeHandoffCode(CODE, STATE)).toBeNull();
        });
    });

    it('generateHandoffToken / isHandoffToken agree on the 64-hex format', () => {
        expect(isHandoffToken(generateHandoffToken())).toBe(true);
        expect(isHandoffToken(undefined)).toBe(false);
    });

    describe('handoffStateCookie', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('production: __Host- prefixed, Secure, Path=/, host-only, httpOnly, lax', () => {
            vi.stubEnv('NODE_ENV', 'production');
            expect(handoffStateCookieName()).toBe(
                '__Host-siglens_ai_sso_state'
            );
            const cookie = handoffStateCookie(STATE);
            expect(cookie).toMatchObject({
                name: '__Host-siglens_ai_sso_state',
                value: STATE,
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                maxAge: HANDOFF_STATE_TTL_SECONDS,
            });
            expect(cookie).not.toHaveProperty('domain');
        });

        it('non-secure env: plain name (browsers reject __Host- without Secure), same other attributes', () => {
            vi.stubEnv('NODE_ENV', 'development');
            expect(handoffStateCookieName()).toBe('siglens_ai_sso_state');
            const cookie = handoffStateCookie(STATE);
            expect(cookie).toMatchObject({
                name: 'siglens_ai_sso_state',
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/',
                maxAge: HANDOFF_STATE_TTL_SECONDS,
            });
            expect(cookie).not.toHaveProperty('domain');
        });

        it('an empty value clears the cookie', () => {
            expect(handoffStateCookie('')).toMatchObject({
                maxAge: 0,
                expires: new Date(0),
            });
        });
    });
});
