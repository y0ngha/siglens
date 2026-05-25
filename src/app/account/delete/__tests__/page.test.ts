vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/account-delete', () => ({
    DeleteAccountConfirm: () => null,
}));
vi.mock('@/entities/session', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { metadata } from '@/app/account/delete/page';

describe('Delete account page', () => {
    it('exports metadata with delete title', () => {
        expect(metadata.title).toBe('회원 탈퇴');
    });

    it('sets robots to noindex, nofollow', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/account/delete'
        );
    });
});
