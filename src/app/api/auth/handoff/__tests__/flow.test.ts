import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * start (ai) → issue (main) → consume (ai) wired together through the real
 * handoffStore against an in-memory Redis, so the state/code/cookie contract
 * between the three routes is checked end to end rather than per-route mocks.
 */
const m = vi.hoisted(() => {
    const store = new Map<string, string>();
    return {
        store,
        redis: {
            set: vi.fn(async (key: string, value: string) => {
                store.set(key, value);
                return 'OK';
            }),
            getdel: vi.fn(async (key: string) => {
                const value = store.get(key) ?? null;
                store.delete(key);
                return value;
            }),
        },
        user: vi.fn(),
        createSession: vi.fn(),
    };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => m.redis,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: m.user,
}));
vi.mock('@/entities/auth/lib/sessionCookie', async importOriginal => ({
    ...(await importOriginal<object>()),
    createAuthSession: m.createSession,
}));
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/auth/api', () => ({ DrizzleSessionRepository: vi.fn() }));
vi.mock('@/shared/config/aiHost', () => ({
    AI_SITE_URL: 'https://ai.siglens.io',
    isAiHost: (h: string | null) => h === 'ai.siglens.io',
}));
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));

import { NextRequest } from 'next/server';
import { GET as consume } from '@/app/api/auth/handoff/consume/route';
import { GET as issue } from '@/app/api/auth/handoff/route';
import { GET as start } from '@/app/api/auth/handoff/start/route';

const request = (url: URL | string, cookie?: string) => {
    const host = new URL(url).host;
    return new NextRequest(url, {
        headers: cookie ? { host, cookie } : { host },
    });
};

describe('SSO handoff: start → issue → consume', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        m.store.clear();
    });

    it('binds the browser, issues a state-bound code and signs in on the ai host', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        m.user.mockResolvedValue({ id: 'u1' });
        m.createSession.mockImplementation(async (p: { userId: string }) => ({
            session: { id: 'tok' },
            cookie: {
                name: 'siglens_session',
                value: `tok-${p.userId}`,
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                expires: new Date(Date.now() + 1000),
                maxAgeSeconds: 1000,
            },
        }));

        const startRes = await start(
            request(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2Fen%2Fc%2Fabc'
            )
        );
        const issueUrl = new URL(startRes.headers.get('location')!);
        const state = issueUrl.searchParams.get('state');
        // `name=value` of the Set-Cookie is what the browser sends back.
        const stateCookie = startRes.headers.getSetCookie()[0]!.split(';')[0]!;
        expect(stateCookie).toBe(`__Host-siglens_ai_sso_state=${state}`);

        const issueRes = await issue(request(issueUrl));
        const consumeUrl = new URL(issueRes.headers.get('location')!);
        expect(consumeUrl.origin + consumeUrl.pathname).toBe(
            'https://ai.siglens.io/api/auth/handoff/consume'
        );
        const code = consumeUrl.searchParams.get('code')!;
        expect(JSON.parse(m.store.get(`auth:handoff:${code}`)!)).toEqual({
            userId: 'u1',
            next: '/en/c/abc',
            state,
        });

        const consumeRes = await consume(request(consumeUrl, stateCookie));
        expect(consumeRes.status).toBe(302);
        expect(consumeRes.headers.get('location')).toBe(
            'https://ai.siglens.io/en/c/abc'
        );
        expect(m.createSession).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', secureCookie: true })
        );
        const cookies = consumeRes.headers.getSetCookie();
        expect(cookies.find(c => c.startsWith('siglens_session='))).toContain(
            'siglens_session=tok-u1'
        );
        expect(
            cookies.find(c => c.startsWith('__Host-siglens_ai_sso_state='))
        ).toContain('Max-Age=0');
        // Single use: the code is gone.
        expect(m.store.size).toBe(0);
    });

    it('a /ko//evil.com next stays on the ai origin through the whole chain', async () => {
        m.user.mockResolvedValue({ id: 'u1' });
        m.createSession.mockResolvedValue({
            session: { id: 'tok' },
            cookie: {
                name: 'siglens_session',
                value: 'tok',
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/',
                expires: new Date(Date.now() + 1000),
                maxAgeSeconds: 1000,
            },
        });
        const startRes = await start(
            request(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2Fko%2F%2Fevil.com'
            )
        );
        const stateCookie = startRes.headers.getSetCookie()[0]!.split(';')[0]!;
        const issueRes = await issue(
            request(new URL(startRes.headers.get('location')!))
        );
        const consumeRes = await consume(
            request(new URL(issueRes.headers.get('location')!), stateCookie)
        );
        const final = new URL(consumeRes.headers.get('location')!);
        expect(final.host).toBe('ai.siglens.io');
        expect(final.pathname).toBe('/evil.com');
    });
});
