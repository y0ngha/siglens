import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consume: vi.fn(), createSession: vi.fn() }));
vi.mock('@/entities/auth/lib/handoffStore', async importOriginal => ({
    ...(await importOriginal<object>()),
    consumeHandoffCode: m.consume,
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

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/handoff/consume/route';

const CODE = 'c'.repeat(64);
const STATE = 'b'.repeat(64);
const req = (qs: string, host = 'ai.siglens.io', cookie?: string) =>
    new NextRequest(`https://${host}/api/auth/handoff/consume${qs}`, {
        headers: cookie ? { host, cookie } : { host },
    });

function setCookies(res: Response): string[] {
    return res.headers.getSetCookie();
}

describe('GET /api/auth/handoff/consume (ai host: exchange)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('valid code + state cookie → session → host-only cookie → 302 next, no-store', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        m.consume.mockResolvedValue({ userId: 'u1', next: '/c/abc' });
        m.createSession.mockImplementation(
            async (p: { secureCookie: boolean }) => ({
                session: { id: 'tok' },
                cookie: {
                    name: 'siglens_session',
                    value: 'tok',
                    httpOnly: true,
                    secure: p.secureCookie,
                    sameSite: 'lax',
                    path: '/',
                    expires: new Date(Date.now() + 1000),
                    maxAgeSeconds: 1000,
                },
            })
        );
        const res = await GET(
            req(
                `?code=${CODE}`,
                'ai.siglens.io',
                `__Host-siglens_ai_sso_state=${STATE}`
            )
        );
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('https://ai.siglens.io/c/abc');
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(m.consume).toHaveBeenCalledWith(CODE, STATE);
        expect(m.createSession).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', secureCookie: true })
        );

        const cookies = setCookies(res);
        const session = cookies.find(c => c.startsWith('siglens_session='));
        expect(session).toBeDefined();
        expect(session).toContain('siglens_session=tok');
        expect(session).toContain('HttpOnly');
        expect(session).toContain('Secure');
        expect(session!.toLowerCase()).toContain('samesite=lax');
        for (const c of cookies)
            expect(c.toLowerCase()).not.toContain('domain=');
        expect(cookies.some(c => c.startsWith('siglens_auth=1'))).toBe(true);
        // The single-use state cookie is cleared.
        const state = cookies.find(c =>
            c.startsWith('__Host-siglens_ai_sso_state=')
        );
        expect(state).toContain('Max-Age=0');
        expect(state).toContain('Secure');
        expect(state).toMatch(/Path=\/(;|$)/);
    });

    it('Secure follows isSecureCookieEnv (off in dev over http)', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        m.consume.mockResolvedValue({ userId: 'u1', next: '/' });
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
        await GET(
            req(
                `?code=${CODE}`,
                'ai.siglens.io',
                `siglens_ai_sso_state=${STATE}`
            )
        );
        expect(m.createSession).toHaveBeenCalledWith(
            expect.objectContaining({ secureCookie: false })
        );
    });

    it('rejected code (invalid/reused/state mismatch) → /?sso=none, no session, state cleared', async () => {
        m.consume.mockResolvedValue(null);
        const res = await GET(req(`?code=${CODE}`));
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/?sso=none'
        );
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(m.consume).toHaveBeenCalledWith(CODE, undefined);
        expect(m.createSession).not.toHaveBeenCalled();
        const cookies = setCookies(res);
        expect(cookies.some(c => c.startsWith('siglens_session='))).toBe(false);
        expect(
            cookies.find(c => c.startsWith('siglens_ai_sso_state='))
        ).toContain('Max-Age=0');
    });

    it.each([
        [
            'production ignores the plain name',
            'production',
            `siglens_ai_sso_state=${STATE}`,
        ],
        [
            'dev ignores the __Host- name',
            'development',
            `__Host-siglens_ai_sso_state=${STATE}`,
        ],
    ])(
        'state cookie under the wrong name (%s) → not read → ?sso=none',
        async (_label, env, cookie) => {
            vi.stubEnv('NODE_ENV', env);
            m.consume.mockImplementation(
                async (_code: string, state?: string) =>
                    state === STATE ? { userId: 'u1', next: '/c/abc' } : null
            );
            const res = await GET(
                req(`?code=${CODE}`, 'ai.siglens.io', cookie)
            );
            expect(m.consume).toHaveBeenCalledWith(CODE, undefined);
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/?sso=none'
            );
            expect(m.createSession).not.toHaveBeenCalled();
        }
    );

    it('session creation fails (e.g. user deleted) → ?sso=none, no-store, state cleared, one log without the error', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            m.consume.mockResolvedValue({ userId: 'u1', next: '/c/abc' });
            m.createSession.mockRejectedValue(
                new Error('insert violates foreign key user_id=u1 a@b.com')
            );
            const res = await GET(
                req(
                    `?code=${CODE}`,
                    'ai.siglens.io',
                    `siglens_ai_sso_state=${STATE}`
                )
            );
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/?sso=none'
            );
            expect(res.headers.get('cache-control')).toBe('no-store');
            const cookies = setCookies(res);
            expect(cookies.some(c => c.startsWith('siglens_session='))).toBe(
                false
            );
            expect(
                cookies.find(c => c.startsWith('siglens_ai_sso_state='))
            ).toContain('Max-Age=0');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0]).toEqual([
                '[handoff] session create failed',
                { userId: 'u1' },
            ]);
        } finally {
            spy.mockRestore();
        }
    });

    it('session creation fails for a stored en next → the en landing /en?sso=none', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            m.consume.mockResolvedValue({ userId: 'u1', next: '/en/c/abc' });
            m.createSession.mockRejectedValue(new Error('user gone'));
            const res = await GET(req(`?code=${CODE}`));
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/en?sso=none'
            );
            expect(res.headers.get('cache-control')).toBe('no-store');
        } finally {
            spy.mockRestore();
        }
    });

    it.each([
        // One locale prefix is stripped; the leftover `/ko//evil.com` is still a same-origin path.
        ['/ko/ko//evil.com', 'https://ai.siglens.io/ko//evil.com'],
        ['/ko//evil.com', 'https://ai.siglens.io/evil.com'],
        ['/api/auth/handoff/start?next=%2Fc%2Fx', 'https://ai.siglens.io/'],
        [
            '/en/api/auth/handoff/start?next=%2Fc%2Fx',
            'https://ai.siglens.io/en',
        ],
    ])(
        'stored next %s → %s (same origin, no chained handoff)',
        async (next, expected) => {
            m.consume.mockResolvedValue({ userId: 'u1', next });
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
            const res = await GET(req(`?code=${CODE}`));
            expect(res.headers.get('location')).toBe(expected);
        }
    );

    it('never redirects off the ai origin even if the store returned a hostile next', async () => {
        m.consume.mockResolvedValue({ userId: 'u1', next: '/\t/evil.com' });
        m.createSession.mockResolvedValue({
            session: { id: 'tok' },
            cookie: {
                name: 'siglens_session',
                value: 'tok',
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/',
                expires: new Date(Date.now() + 1000),
                maxAgeSeconds: 1000,
            },
        });
        const res = await GET(req(`?code=${CODE}`));
        expect(new URL(res.headers.get('location')!).origin).toBe(
            'https://ai.siglens.io'
        );
    });

    it('Redis error → ?sso=none with a single marker log', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            m.consume.mockRejectedValue(new Error('network'));
            const res = await GET(req(`?code=${CODE}`));
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/?sso=none'
            );
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0]?.[0]).toBe('[handoff] redis unavailable');
        } finally {
            spy.mockRestore();
        }
    });

    it('main host → 400, no-store, never consumes', async () => {
        const res = await GET(req(`?code=${CODE}`, 'siglens.io'));
        expect(res.status).toBe(400);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(m.consume).not.toHaveBeenCalled();
    });
});
