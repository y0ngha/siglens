vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-signup', () => ({ SignupForm: () => null }));
vi.mock('@/features/auth-oauth/ui/SocialLoginButtons', () => ({
    SocialLoginButtons: () => null,
}));
vi.mock('@/shared/lib/auth/redirect', () => ({
    sanitizeNextPath: vi.fn().mockReturnValue('/'),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import { generateMetadata } from '@/app/[locale]/signup/page';

describe('Signup page', () => {
    it('exports metadata with signup title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('회원가입');
    });

    it('sets robots to noindex', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/signup'
        );
    });
});
