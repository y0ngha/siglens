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

            // `next`는 이제 항상 인코딩한다 — 심볼이 붙으면 값에 `?`와 `=`가
            // 들어가므로, 인코딩하지 않으면 쿼리 경계가 깨진다. 값이 단순할
            // 때만 안 붙이는 두 갈래를 두지 않는다.
            expect(mockRedirect).toHaveBeenCalledWith(
                '/login?next=%2Fonboarding'
            );
        });

        /**
         * `/[symbol]/position`의 CTA에서 온 사용자는 심볼을 들고 온다. 예전에는
         * 리디렉트 대상이 `'/login?next=/onboarding'` 문자열 리터럴이라 그
         * 심볼이 로그인 홉에서 버려졌고, 로그인을 마쳐도 아무것도 채워지지 않은
         * 온보딩 화면에 떨어졌다.
         */
        it('심볼을 로그인 next에 이어 붙인다', async () => {
            mockGetCurrentUser.mockResolvedValue(null);

            await OnboardingGuard({ locale: 'ko', symbol: 'AAPL' });

            expect(mockRedirect).toHaveBeenCalledWith(
                '/login?next=%2Fonboarding%3Fsymbol%3DAAPL'
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
