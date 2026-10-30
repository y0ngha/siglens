/**
 * `ConsentContent` — 토큰 판정이 스토어 조회보다 먼저다. 잘못된 토큰(빈 값·반복된 키)은 스토어를
 * 열지 않고 `consentInvalid`로, 유효한 문자열 토큰만 `peek`로 조회한다.
 */
vi.mock('@/features/auth-oauth-consent/ui/OAuthConsentForm', () => ({
    OAuthConsentForm: () => null,
}));
vi.mock('@/entities/oauth-account/server/pendingOAuthSignupStore', () => ({
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));
vi.mock('@/features/auth-oauth/actions/cancelOAuthSignupAction', () => ({
    cancelOAuthSignupAction: vi.fn(),
}));
vi.mock('@/entities/auth/lib/errorMessages', () => ({
    OAUTH_ERROR_REDIRECT: {
        consentInvalid: '/login?error=oauth_consent_invalid',
        serviceUnavailable: '/login?error=service_unavailable',
        consentExpired: '/login?error=oauth_consent_expired',
    },
}));
vi.mock('@/shared/i18n/localeRedirect', () => ({
    localeRedirect: vi.fn(async (path: string) => {
        throw new Error(`NEXT_REDIRECT ${path}`);
    }),
}));

import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/server/pendingOAuthSignupStore';
import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { ConsentContent } from '../ConsentContent';

describe('ConsentContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['반복된 키(배열)', ['a', 'b']],
        ['빈 토큰', ''],
    ])(
        '%s면 스토어를 열지 않고 consentInvalid로 보낸다',
        async (_label, token) => {
            const peek = vi.fn();
            vi.mocked(createPendingOAuthSignupStoreFromEnv).mockReturnValue({
                peek,
            } as never);

            await expect(
                ConsentContent({ searchParams: Promise.resolve({ token }) })
            ).rejects.toThrow('NEXT_REDIRECT');

            expect(localeRedirect).toHaveBeenCalledWith(
                '/login?error=oauth_consent_invalid'
            );
            expect(createPendingOAuthSignupStoreFromEnv).not.toHaveBeenCalled();
            expect(peek).not.toHaveBeenCalled();
        }
    );

    it('문자열 토큰은 스토어에서 조회한다', async () => {
        const peek = vi.fn().mockResolvedValue(null);
        vi.mocked(createPendingOAuthSignupStoreFromEnv).mockReturnValue({
            peek,
        } as never);

        await expect(
            ConsentContent({ searchParams: Promise.resolve({ token: 'abc' }) })
        ).rejects.toThrow('NEXT_REDIRECT');

        expect(peek).toHaveBeenCalledWith('abc');
        expect(localeRedirect).toHaveBeenCalledWith(
            '/login?error=oauth_consent_expired'
        );
    });
});
