import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    cookieValue: undefined as string | undefined,
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === 'siglens_session' && m.cookieValue !== undefined
                ? { name, value: m.cookieValue }
                : undefined,
    }),
}));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));

import { maybeHandoffRedirect } from '@/app/ai/[locale]/handoffRedirect';

describe('maybeHandoffRedirect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.cookieValue = undefined;
    });

    it('no session and no sso=none → redirects to the same-host start route with a locale-prefixed next', async () => {
        await expect(maybeHandoffRedirect('en', '/c/abc', {})).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(m.redirect).toHaveBeenCalledWith(
            '/api/auth/handoff/start?next=%2Fen%2Fc%2Fabc'
        );
    });

    it('default locale has no prefix; unknown locale falls back to it', async () => {
        await expect(maybeHandoffRedirect('ko', '/', {})).rejects.toThrow();
        await expect(maybeHandoffRedirect('xx', '/c/1', {})).rejects.toThrow();
        expect(m.redirect.mock.calls.map(c => c[0])).toEqual([
            '/api/auth/handoff/start?next=%2F',
            '/api/auth/handoff/start?next=%2Fc%2F1',
        ]);
    });

    it('does nothing when an ai-host session cookie exists', async () => {
        m.cookieValue = 'tok';
        await maybeHandoffRedirect('ko', '/', {});
        expect(m.redirect).not.toHaveBeenCalled();
    });

    it('does nothing after a failed handoff (?sso=none) — no loop', async () => {
        await maybeHandoffRedirect('ko', '/', { sso: 'none' });
        expect(m.redirect).not.toHaveBeenCalled();
    });
});
