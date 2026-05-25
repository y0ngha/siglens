vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/auth-signup', () => ({ SignupForm: () => null }));
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

import { metadata } from '@/app/signup/page';

describe('Signup page', () => {
    it('exports metadata with signup title', () => {
        expect(metadata.title).toBe('회원가입');
    });

    it('sets robots to noindex', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/signup'
        );
    });
});
