vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-password-reset', () => ({
    ForgotPasswordForm: () => null,
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));

import { metadata } from '@/app/forgot-password/page';

describe('ForgotPassword page', () => {
    it('exports metadata with forgot-password title', () => {
        expect(metadata.title).toBe('비밀번호 찾기');
    });

    it('sets robots to noindex', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/forgot-password'
        );
    });
});
