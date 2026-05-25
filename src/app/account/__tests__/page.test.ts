vi.mock('@/features/api-key-management', () => ({
    ApiKeySection: () => null,
}));
vi.mock('@/entities/session', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/entities/api-key/actions', () => ({
    getRegisteredProvidersAction: vi.fn(),
}));
vi.mock('@/shared/lib/auth/tierLabel', () => ({
    TIER_LABEL: { free: '무료' },
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { metadata } from '@/app/account/page';

describe('Account page', () => {
    it('exports metadata with account title', () => {
        expect(metadata.title).toBe('계정 설정');
    });

    it('sets robots to noindex, nofollow', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/account'
        );
    });
});
