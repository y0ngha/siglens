import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    consume: vi.fn(),
    getCurrentUser: vi.fn(),
    logoutUser: vi.fn(),
}));
vi.mock('@/entities/auth/lib/handoffStore', async importOriginal => ({
    ...(await importOriginal<object>()),
    consumeLogoutCode: m.consume,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: m.getCurrentUser,
}));
vi.mock('@/entities/auth/lib/logoutUser', () => ({ logoutUser: m.logoutUser }));
vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/auth/api', () => ({ DrizzleSessionRepository: vi.fn() }));
vi.mock('@/shared/config/aiHost', () => ({
    AI_SITE_URL: 'https://ai.siglens.io',
    isAiHost: (h: string | null) => h === 'ai.siglens.io',
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/handoff/logout/route';

const CODE = 'c'.repeat(64);
const req = (host = 'siglens.io', cookie = 'siglens_session=main-tok') =>
    new NextRequest(`https://${host}/api/auth/handoff/logout?code=${CODE}`, {
        headers: { host, cookie },
    });

const EXPIRED = {
    name: 'siglens_session',
    value: '',
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(0),
    maxAgeSeconds: 0,
};

describe('GET /api/auth/handoff/logout (main host: end the main session too)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.logoutUser.mockResolvedValue({
            ok: true,
            sessionInvalidated: true,
            cookie: EXPIRED,
        });
    });

    it('same user → deletes the main session, clears cookies, 302 to the ai landing ?sso=none', async () => {
        m.consume.mockResolvedValue({ userId: 'u1', locale: 'en' });
        m.getCurrentUser.mockResolvedValue({ id: 'u1' });

        const res = await GET(req());

        expect(m.consume).toHaveBeenCalledWith(CODE);
        expect(m.logoutUser).toHaveBeenCalledWith(
            { sessionToken: 'main-tok' },
            expect.any(Object),
            expect.any(Object)
        );
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/en?sso=none'
        );
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(
            res.headers
                .getSetCookie()
                .some(c => c.startsWith('siglens_session=;'))
        ).toBe(true);
    });

    /** Logout CSRF: a code minted for the attacker's own account must not end the victim's session. */
    it('different main user → main session untouched', async () => {
        m.consume.mockResolvedValue({ userId: 'attacker', locale: 'ko' });
        m.getCurrentUser.mockResolvedValue({ id: 'victim' });

        const res = await GET(req());

        expect(m.logoutUser).not.toHaveBeenCalled();
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/?sso=none'
        );
        expect(res.headers.getSetCookie()).toEqual([]);
    });

    it.each([
        ['invalid/reused code', () => m.consume.mockResolvedValue(null)],
        [
            'redis down',
            () => m.consume.mockRejectedValue(new Error('redis down')),
        ],
    ])(
        '%s → main session untouched, ai landing ?sso=none',
        async (_, arrange) => {
            arrange();
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const res = await GET(req());

            expect(m.logoutUser).not.toHaveBeenCalled();
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/?sso=none'
            );
        }
    );

    it('no main session → nothing to end', async () => {
        m.consume.mockResolvedValue({ userId: 'u1', locale: 'ko' });
        m.getCurrentUser.mockResolvedValue(null);

        await GET(req('siglens.io', ''));

        expect(m.logoutUser).not.toHaveBeenCalled();
    });

    it('rejects the ai host', async () => {
        const res = await GET(req('ai.siglens.io'));
        expect(res.status).toBe(400);
        expect(m.consume).not.toHaveBeenCalled();
    });
});
