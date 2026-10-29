vi.mock('@/features/api-key-management/ui/ApiKeySection', () => ({
    ApiKeySection: () => null,
}));
vi.mock(
    '@/features/siglens-api-key-management/ui/SiglensApiKeySection',
    () => ({ SiglensApiKeySection: () => null })
);
vi.mock('@/entities/siglens-api-key/actions/listSiglensApiKeysAction', () => ({
    listSiglensApiKeysAction: vi.fn(),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/api-key/actions/getRegisteredProvidersAction', () => ({
    getRegisteredProvidersAction: vi.fn(),
}));
vi.mock('@/shared/lib/auth/tierLabel', () => ({
    TIER_LABEL: { free: '무료' },
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { AccountContent } from '@/app/[locale]/account/_components/AccountContent';
import { generateMetadata } from '@/app/[locale]/account/page';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions/getRegisteredProvidersAction';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';

describe('Account page', () => {
    it('exports metadata with account title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('계정 설정');
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
            'https://siglens.io/account'
        );
    });
});

describe('AccountContent', () => {
    it('세션이 유효하지 않으면 돌아올 경로를 달아 로케일 로그인으로 보낸다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        vi.mocked(getRegisteredProvidersAction).mockResolvedValue([]);
        vi.mocked(redirect).mockImplementationOnce(() => {
            throw new Error('NEXT_REDIRECT');
        });

        await expect(AccountContent({ locale: 'en' })).rejects.toThrow(
            'NEXT_REDIRECT'
        );
        expect(redirect).toHaveBeenCalledWith('/en/login?next=%2Fen%2Faccount');
    });
});
