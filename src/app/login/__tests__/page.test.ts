vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-login', () => ({ LoginForm: () => null }));
vi.mock('@/features/auth-oauth', () => ({
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

import { metadata } from '@/app/login/page';

describe('Login page', () => {
    it('exports metadata with login title', () => {
        expect(metadata.title).toBe('로그인');
    });

    it('sets robots to noindex', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/login');
    });

    it('sets openGraph url', () => {
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({ url: 'https://siglens.io/login' })
        );
    });
});
