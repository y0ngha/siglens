import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    cookieValue: undefined as string | undefined,
    probedCookieValue: undefined as string | undefined,
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));
vi.mock('next/headers', () => ({
    headers: async () => new Headers({ 'user-agent': m.userAgent }),
    cookies: async () => ({
        get: (name: string) => {
            if (name === 'siglens_session' && m.cookieValue !== undefined)
                return { name, value: m.cookieValue };
            if (
                name === 'siglens_ai_sso_probed' &&
                m.probedCookieValue !== undefined
            )
                return { name, value: m.probedCookieValue };
            return undefined;
        },
    }),
}));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));

import { maybeHandoffRedirect } from '@/app/ai/[locale]/handoffRedirect';

describe('maybeHandoffRedirect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.cookieValue = undefined;
        m.probedCookieValue = undefined;
        m.userAgent = 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36';
    });

    it('crawler UA → no redirect, so the landing itself is what gets indexed', async () => {
        m.userAgent =
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        await maybeHandoffRedirect('ko', '/', {});
        expect(m.redirect).not.toHaveBeenCalled();
    });

    it('carries a prefilled ?q= through next', async () => {
        await expect(
            maybeHandoffRedirect('en', '/', { q: 'NVDA 어때?' })
        ).rejects.toThrow('NEXT_REDIRECT');
        expect(m.redirect).toHaveBeenCalledWith(
            `/api/auth/handoff/start?next=${encodeURIComponent(`/en?q=${encodeURIComponent('NVDA 어때?')}`)}`
        );
    });

    it('carries ad attribution params (gclid, utm_*) through next and drops the rest', async () => {
        await expect(
            maybeHandoffRedirect('ko', '/', {
                gclid: 'G1',
                utm_source: 'google',
                utm_campaign: 'b',
                foo: 'x',
            })
        ).rejects.toThrow('NEXT_REDIRECT');
        expect(m.redirect).toHaveBeenCalledWith(
            `/api/auth/handoff/start?next=${encodeURIComponent('/?gclid=G1&utm_source=google&utm_campaign=b')}`
        );
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

    /**
     * `?sso=none`은 클라이언트가 주소창에서 지우고, 방문자는 랜딩에서 다른 링크
     * (`/c/<id>`, 언어 전환)로 나간다. 파라미터가 사라진 요청이 같은 핸드오프 왕복을
     * 또 돌리지 않게, 프록시가 심은 프로브 쿠키가 같은 신호로 읽혀야 한다.
     */
    it('프로브 쿠키가 있으면 sso 파라미터가 없어도 재시도하지 않는다 — 왕복 반복 없음', async () => {
        m.probedCookieValue = '1';
        await maybeHandoffRedirect('ko', '/c/abc', {});
        expect(m.redirect).not.toHaveBeenCalled();
    });

    it('프로브 쿠키가 없고 sso도 없으면 여전히 핸드오프로 보낸다', async () => {
        await expect(maybeHandoffRedirect('ko', '/', {})).rejects.toThrow(
            'NEXT_REDIRECT'
        );
    });
});
