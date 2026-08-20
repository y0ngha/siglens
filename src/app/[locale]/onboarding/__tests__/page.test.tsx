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

import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    generateMetadata,
    OnboardingGuard,
    OnboardingSkeleton,
} from '@/app/[locale]/onboarding/page';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockRedirect = vi.mocked(redirect);

describe('Onboarding page', () => {
    it('exports metadata with onboarding title', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(metadata.title).toBe('보유종목 등록');
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
            'https://siglens.io/onboarding'
        );
    });

    describe('OnboardingGuard', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('redirects unauthenticated visitors to /login?next=/onboarding', async () => {
            mockGetCurrentUser.mockResolvedValue(null);

            await OnboardingGuard({ locale: 'ko' });

            // `next`는 인코딩된다 — 프록시의 전방 가드도 `searchParams.set`으로
            // 같은 인코딩을 쓴다(로그인 페이지는 `searchParams.get`으로 디코딩).
            expect(mockRedirect).toHaveBeenCalledWith(
                `/login?next=${encodeURIComponent('/onboarding')}`
            );
        });

        it('does not redirect an authenticated member', async () => {
            mockGetCurrentUser.mockResolvedValue({
                id: 'user-1',
            } as never);

            await OnboardingGuard({ locale: 'ko' });

            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('OnboardingSkeleton', () => {
        it('exposes exactly one h1 while the guard is loading', () => {
            render(<OnboardingSkeleton />);

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                '보유종목을 등록해 보세요'
            );
        });
    });
});
