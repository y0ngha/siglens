import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ user: vi.fn(), issue: vi.fn() }));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: m.user,
}));
vi.mock('@/entities/auth/lib/handoffStore', async importOriginal => ({
    ...(await importOriginal<object>()),
    issueHandoffCode: m.issue,
}));
vi.mock('@/shared/config/aiHost', () => ({
    AI_SITE_URL: 'https://ai.siglens.io',
    isAiHost: (h: string | null) => h === 'ai.siglens.io',
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/handoff/route';

const STATE = 'b'.repeat(64);
const CODE = 'c'.repeat(64);
const req = (qs: string, host = 'siglens.io') =>
    new NextRequest(`https://${host}/api/auth/handoff${qs}`, {
        headers: { host },
    });

describe('GET /api/auth/handoff (main host: issue)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('signed in + valid state → issues a state-bound code → 302 to ai consume, no-store', async () => {
        m.user.mockResolvedValue({ id: 'u1' });
        m.issue.mockResolvedValue(CODE);
        const res = await GET(req(`?to=ai&next=%2Fc%2Fabc&state=${STATE}`));
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(
            `https://ai.siglens.io/api/auth/handoff/consume?code=${CODE}`
        );
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(m.issue).toHaveBeenCalledWith({
            userId: 'u1',
            next: '/c/abc',
            state: STATE,
        });
    });

    it('no session → ai next with ?sso=none', async () => {
        m.user.mockResolvedValue(null);
        const res = await GET(
            req(`?to=ai&next=%2Fen%2Fc%2Fabc&state=${STATE}`)
        );
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/en/c/abc?sso=none'
        );
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(m.issue).not.toHaveBeenCalled();
    });

    it.each([
        ['absolute URL', 'https%3A%2F%2Fevil.com%2Fx'],
        ['protocol-relative', '%2F%2Fevil.com'],
        ['tab trick', '%2F%09%2Fevil.com'],
    ])('never leaves the ai origin for a %s next', async (_label, next) => {
        m.user.mockResolvedValue(null);
        const res = await GET(req(`?to=ai&next=${next}&state=${STATE}`));
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/?sso=none'
        );
    });

    /** `splitLocalePath` + `localePath` round-trip must not recreate `//host`. */
    it.each([
        ['/ko//evil.com', '%2Fko%2F%2Fevil.com'],
        ['/ko/.//evil.com', '%2Fko%2F.%2F%2Fevil.com'],
        ['/ko/\\evil.com', '%2Fko%2F%5Cevil.com'],
    ])(
        'never leaves the ai origin for %s (fallback and start bounce)',
        async (_label, next) => {
            m.user.mockResolvedValue(null);
            const fallback = new URL(
                (
                    await GET(req(`?to=ai&next=${next}&state=${STATE}`))
                ).headers.get('location')!
            );
            expect(fallback.origin).toBe('https://ai.siglens.io');
            expect(fallback.pathname).toBe('/evil.com');

            const start = new URL(
                (await GET(req(`?to=ai&next=${next}`))).headers.get('location')!
            );
            expect(start.origin).toBe('https://ai.siglens.io');
            expect(start.searchParams.get('next')).toBe('/evil.com');
        }
    );

    it('a next that is itself an /api handoff path falls back to the ai root (no chained handoff)', async () => {
        m.user.mockResolvedValue(null);
        const res = await GET(
            req(
                `?to=ai&next=${encodeURIComponent('/en/api/auth/handoff/start?next=%2Fc%2Fx')}&state=${STATE}`
            )
        );
        expect(res.headers.get('location')).toBe(
            'https://ai.siglens.io/en?sso=none'
        );
    });

    it('missing or malformed state → bounces to the ai start route to bind the browser (no session lookup)', async () => {
        for (const qs of [
            '?to=ai&next=%2Fc%2Fabc',
            '?to=ai&next=%2Fc%2Fabc&state=xyz',
        ]) {
            const res = await GET(req(qs));
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2Fc%2Fabc'
            );
            expect(res.headers.get('cache-control')).toBe('no-store');
        }
        expect(m.user).not.toHaveBeenCalled();
    });

    it('Redis unavailable → ?sso=none (not 500) and a single marker log', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            m.user.mockResolvedValue({ id: 'u1' });
            m.issue.mockRejectedValue(new Error('[handoff] redis unavailable'));
            const res = await GET(req(`?to=ai&next=%2Fc%2Fabc&state=${STATE}`));
            expect(res.status).toBe(302);
            expect(res.headers.get('location')).toBe(
                'https://ai.siglens.io/c/abc?sso=none'
            );
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0]?.[0]).toBe('[handoff] redis unavailable');
        } finally {
            spy.mockRestore();
        }
    });

    it('rejects a non-enum `to` and the ai host with 400, no-store', async () => {
        for (const res of [
            await GET(req(`?to=evil&state=${STATE}`)),
            await GET(req('?next=%2F')),
            await GET(req(`?to=ai&state=${STATE}`, 'ai.siglens.io')),
        ]) {
            expect(res.status).toBe(400);
            expect(res.headers.get('cache-control')).toBe('no-store');
            expect(res.headers.get('location')).toBeNull();
        }
        expect(m.user).not.toHaveBeenCalled();
    });
});
