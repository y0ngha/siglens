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

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { metadata, OnboardingGuard } from '@/app/onboarding/page';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

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

    describe('OnboardingGuard', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('redirects unauthenticated visitors to /login?next=/onboarding', async () => {
            mockGetCurrentUser.mockResolvedValue(null);

            await OnboardingGuard();

            expect(mockRedirect).toHaveBeenCalledWith(
                '/login?next=/onboarding'
            );
        });

        it('does not redirect an authenticated member', async () => {
            mockGetCurrentUser.mockResolvedValue({
                id: 'user-1',
            } as never);

            await OnboardingGuard();

            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });
});
