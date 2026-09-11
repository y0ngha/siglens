import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/aiHost', () => ({
    AI_SITE_URL: 'https://ai.siglens.io',
    isAiHost: (h: string | null) => h === 'ai.siglens.io',
}));
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/handoff/start/route';

const req = (qs: string, host = 'ai.siglens.io') =>
    new NextRequest(`https://${host}/api/auth/handoff/start${qs}`, {
        headers: { host },
    });

describe('GET /api/auth/handoff/start (ai host: bind browser)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('sets a host-only state cookie and redirects to the main issue route with the same state', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        const res = await GET(req('?next=%2Fen%2Fc%2Fabc'));
        expect(res.status).toBe(302);
        expect(res.headers.get('cache-control')).toBe('no-store');

        const location = new URL(res.headers.get('location')!);
        expect(location.origin).toBe('https://siglens.io');
        expect(location.pathname).toBe('/api/auth/handoff');
        expect(location.searchParams.get('to')).toBe('ai');
        expect(location.searchParams.get('next')).toBe('/en/c/abc');
        const state = location.searchParams.get('state');
        expect(state).toMatch(/^[0-9a-f]{64}$/);

        const cookie = res.headers.get('set-cookie') ?? '';
        expect(cookie.startsWith(`__Host-siglens_ai_sso_state=${state};`)).toBe(
            true
        );
        expect(cookie).toMatch(/Path=\/(;|$)/);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie.toLowerCase()).toContain('samesite=lax');
        expect(cookie.toLowerCase()).not.toContain('domain=');
    });

    it('non-secure env: plain cookie name, no Secure', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const res = await GET(req('?next=%2F'));
        const state = new URL(res.headers.get('location')!).searchParams.get(
            'state'
        );
        const cookie = res.headers.get('set-cookie') ?? '';
        expect(cookie.startsWith(`siglens_ai_sso_state=${state};`)).toBe(true);
        expect(cookie).toMatch(/Path=\/(;|$)/);
        expect(cookie).not.toContain('Secure');
        expect(cookie.toLowerCase()).not.toContain('domain=');
    });

    it('issues a fresh state per request', async () => {
        const a = new URL((await GET(req(''))).headers.get('location')!);
        const b = new URL((await GET(req(''))).headers.get('location')!);
        expect(a.searchParams.get('state')).not.toBe(
            b.searchParams.get('state')
        );
    });

    it('reduces next to a path', async () => {
        const res = await GET(req('?next=https%3A%2F%2Fevil.com%2Fx'));
        expect(
            new URL(res.headers.get('location')!).searchParams.get('next')
        ).toBe('/');
    });

    it.each([
        [
            'protocol-relative after locale strip',
            '%2Fko%2F%2Fevil.com',
            '/evil.com',
        ],
        [
            'nested handoff',
            encodeURIComponent('/api/auth/handoff/start?next=%2Fc%2Fx'),
            '/',
        ],
    ])('normalizes next (%s)', async (_label, next, expected) => {
        const location = new URL(
            (await GET(req(`?next=${next}`))).headers.get('location')!
        );
        expect(location.origin).toBe('https://siglens.io');
        expect(location.searchParams.get('next')).toBe(expected);
    });

    it('rejects the main host with 400 and sets no cookie', async () => {
        const res = await GET(req('?next=%2F', 'siglens.io'));
        expect(res.status).toBe(400);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(res.headers.get('set-cookie')).toBeNull();
    });
});
