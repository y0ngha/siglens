vi.mock('@/features/portfolio-onboarding', () => ({
    OnboardingContent: () => null,
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('next/navigation', () => ({
    redirect: vi.fn(),
}));

import { metadata } from '@/app/onboarding/page';

describe('Onboarding page', () => {
    it('exports metadata with onboarding title', () => {
        expect(metadata.title).toBe('보유종목 등록');
    });

    it('sets robots to noindex, nofollow', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false, follow: false })
        );
    });

    it('includes canonical URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/onboarding'
        );
    });
});
