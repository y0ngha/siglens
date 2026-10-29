vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-oauth-consent/ui/OAuthConsentForm', () => ({
    OAuthConsentForm: () => null,
}));
vi.mock('@/entities/oauth-account/lib/pendingOAuthSignupStore', () => ({
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
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));
vi.mock('@/shared/i18n/localeRedirect', () => ({
    localeRedirect: vi.fn(async (path: string) => {
        throw new Error(`NEXT_REDIRECT ${path}`);
    }),
}));

import { ConsentContent } from '@/app/[locale]/signup/oauth/consent/_components/ConsentContent';
import { generateMetadata } from '@/app/[locale]/signup/oauth/consent/page';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { localeRedirect } from '@/shared/i18n/localeRedirect';

describe('OAuth consent page', () => {
    it('exports metadata with consent title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('소셜 로그인 가입 동의');
    });

    it('sets robots to noindex, nofollow', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/signup/oauth/consent'
        );
    });

    it('og 제목·URL을 이 페이지 값으로 채운다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en' }),
        });
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({
                title: 'Social sign-up consent',
                url: 'https://siglens.io/en/signup/oauth/consent',
            })
        );
    });

    it('twitter 제목을 루트(홈) 값이 아니라 이 페이지 값으로 덮는다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ title: '소셜 로그인 가입 동의' })
        );
    });
});

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
