const mocks = vi.hoisted(() => ({
    createAuthSession: vi.fn(),
    isSecureCookieEnv: vi.fn(),
}));
vi.mock('@/entities/auth/api', () => ({ DrizzleSessionRepository: vi.fn() }));
vi.mock('@/entities/auth/lib/applyAuthCookie', () => ({
    applyAuthCookie: vi.fn().mockReturnValue({ name: 'auth', value: 'v' }),
}));
vi.mock('@/entities/auth/lib/authHintCookie', () => ({
    createAuthHintCookie: vi.fn().mockReturnValue({ name: 'hint', value: '1' }),
}));
vi.mock('@/entities/auth/lib/sessionCookie', () => ({
    createAuthSession: mocks.createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS: 86400,
}));
vi.mock('@/entities/auth/lib/sessionCookieOptions', () => ({
    isSecureCookieEnv: mocks.isSecureCookieEnv,
}));
vi.mock('@/features/auth-oauth/lib/providers', () => ({
    getOAuthRedirectBaseUrl: vi.fn().mockReturnValue('https://siglens.io'),
}));
vi.mock('@/features/auth-oauth/lib/state', () => ({
    expiredOAuthStateCookie: vi
        .fn()
        .mockReturnValue({ name: 'oauth_state', value: '', maxAge: 0 }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirectSignedIn } from '@/app/api/auth/callback/_lib/redirectSignedIn';
import { createAuthHintCookie } from '@/entities/auth/lib/authHintCookie';

describe('redirectSignedIn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isSecureCookieEnv.mockReturnValue(true);
        mocks.createAuthSession.mockResolvedValue({
            cookie: { name: 'session', value: 's' },
        });
    });

    it('해당 사용자의 세션을 만들고 next로 보낸다', async () => {
        const response = await redirectSignedIn('user-1', '/AAPL');

        expect(mocks.createAuthSession).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1', secureCookie: true })
        );
        expect(response.headers.get('location')).toBe(
            'https://siglens.io/AAPL'
        );
    });

    it('세션·로그인 힌트 쿠키를 심고 state 쿠키를 지운다', async () => {
        const response = await redirectSignedIn('user-1', '/');

        expect(response.cookies.get('auth')?.value).toBe('v');
        expect(response.cookies.get('hint')?.value).toBe('1');
        expect(response.cookies.get('oauth_state')?.value).toBe('');
        expect(createAuthHintCookie).toHaveBeenCalledWith({
            maxAgeSeconds: 86400,
            secure: true,
        });
    });

    it('공백 문자로 우회한 off-origin next는 신뢰된 base의 기본 경로로 보낸다', async () => {
        const response = await redirectSignedIn('user-1', '/\t/evil.com');

        expect(response.headers.get('location')).toBe('https://siglens.io/');
    });

    it('dot-segment로 우회한 next도 신뢰된 base로 보낸다', async () => {
        const response = await redirectSignedIn('user-1', '/.//evil.com');

        expect(new URL(response.headers.get('location') ?? '').origin).toBe(
            'https://siglens.io'
        );
    });
});
