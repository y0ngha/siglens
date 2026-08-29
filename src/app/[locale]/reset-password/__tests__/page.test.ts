vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-password-reset', () => ({
    ResetPasswordForm: () => null,
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import { generateMetadata } from '@/app/[locale]/reset-password/page';

describe('ResetPassword page', () => {
    it('exports metadata with reset-password title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('비밀번호 재설정');
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
            'https://siglens.io/reset-password'
        );
    });
});
