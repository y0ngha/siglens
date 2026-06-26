vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-oauth-consent', () => ({
    OAuthConsentForm: () => null,
}));
vi.mock('@/entities/oauth-account', () => ({
    createPendingOAuthSignupStoreFromEnv: vi.fn(),
}));
vi.mock('@/features/auth-oauth/actions', () => ({
    cancelOAuthSignupAction: vi.fn(),
}));
vi.mock('@/entities/auth', () => ({
    OAUTH_ERROR_REDIRECT: {
        consentInvalid: '/login?error=oauth_consent_invalid',
        serviceUnavailable: '/login?error=service_unavailable',
        consentExpired: '/login?error=oauth_consent_expired',
    },
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { metadata } from '@/app/signup/oauth/consent/page';

describe('OAuth consent page', () => {
    it('exports metadata with consent title', () => {
        expect(metadata.title).toBe('소셜 로그인 가입 동의');
    });

    it('sets robots to noindex, nofollow', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/signup/oauth/consent'
        );
    });
});
