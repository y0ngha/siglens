const { mockGetOAuthAdapter } = vi.hoisted(() => ({
    mockGetOAuthAdapter: vi.fn(),
}));
vi.mock('@/features/auth-oauth/lib/providers', () => ({
    buildOAuthRedirectUri: vi
        .fn()
        .mockReturnValue('https://siglens.io/api/auth/callback/google'),
    getOAuthAdapter: mockGetOAuthAdapter,
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exchangeProfile } from '@/app/api/auth/callback/_lib/exchangeProfile';

describe('exchangeProfile', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        mockGetOAuthAdapter.mockReset();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('어댑터 결과를 그대로 돌려주고 코드·리다이렉트 URI를 넘긴다', async () => {
        const result = { ok: false, reason: 'email_missing' };
        const exchange = vi.fn().mockResolvedValue(result);
        mockGetOAuthAdapter.mockReturnValue({
            exchangeCodeForProfile: exchange,
        });

        expect(await exchangeProfile('google', 'the-code')).toBe(result);
        expect(exchange).toHaveBeenCalledWith({
            code: 'the-code',
            redirectUri: 'https://siglens.io/api/auth/callback/google',
        });
    });

    it('어댑터가 던지면 token_exchange_failed로 접는다', async () => {
        mockGetOAuthAdapter.mockReturnValue({
            exchangeCodeForProfile: vi
                .fn()
                .mockRejectedValue(new TypeError('fetch failed')),
        });

        expect(await exchangeProfile('google', 'the-code')).toEqual({
            ok: false,
            reason: 'token_exchange_failed',
        });
    });

    it('던져진 오류의 메시지는 로그에 싣지 않는다', async () => {
        mockGetOAuthAdapter.mockReturnValue({
            exchangeCodeForProfile: vi
                .fn()
                .mockRejectedValue(new TypeError('client_secret=hunter2')),
        });

        await exchangeProfile('google', 'the-code');

        expect(errorSpy).toHaveBeenCalledWith(
            '[oauth-callback] code exchange threw',
            { provider: 'google', name: 'TypeError' }
        );
    });

    it('Error가 아닌 값이 던져져도 접는다', async () => {
        mockGetOAuthAdapter.mockReturnValue({
            exchangeCodeForProfile: vi.fn().mockRejectedValue('boom'),
        });

        expect(await exchangeProfile('google', 'the-code')).toEqual({
            ok: false,
            reason: 'token_exchange_failed',
        });
        expect(errorSpy).toHaveBeenCalledWith(
            '[oauth-callback] code exchange threw',
            { provider: 'google', name: 'string' }
        );
    });
});
