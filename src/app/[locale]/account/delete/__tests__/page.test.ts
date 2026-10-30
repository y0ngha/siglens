vi.mock('@/shared/ui/auth/AuthCardShell', () => ({
    AuthCardShell: () => null,
}));
vi.mock('@/features/account-delete/ui/DeleteAccountConfirm', () => ({
    DeleteAccountConfirm: () => null,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { generateMetadata } from '@/app/[locale]/account/delete/page';

describe('Delete account page', () => {
    it('exports metadata with delete title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('회원 탈퇴');
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
            'https://siglens.io/account/delete'
        );
    });

    it('og 제목·URL을 이 페이지 값으로 채운다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'en' }),
        });
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({
                title: 'Delete account',
                url: 'https://siglens.io/en/account/delete',
            })
        );
    });

    it('twitter 제목을 루트(홈) 값이 아니라 이 페이지 값으로 덮는다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ title: '회원 탈퇴' })
        );
    });
});
