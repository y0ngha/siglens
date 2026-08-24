import { OnboardingContent } from '@/features/portfolio-onboarding';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup/account 정책과 일관).
// 외부에 변형 URL이 공유되더라도 "원본은 /onboarding 하나"라는 신호를 명확히 두면
// 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
export const metadata: Metadata = {
    title: '보유종목 등록',
    description: `${SITE_NAME} 가입 후 보유종목 등록 온보딩 페이지`,
    alternates: { canonical: `${SITE_URL}/onboarding` },
    openGraph: { url: `${SITE_URL}/onboarding` },
    robots: { index: false, follow: false },
};

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
// Exported (rather than module-private) so tests can `await OnboardingGuard()`
// directly and assert the unauthenticated redirect target, mirroring the
// `MarketContent` export pattern in `src/app/market/page.tsx`.
export async function OnboardingGuard() {
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login?next=/onboarding');
    }
    return <OnboardingContent />;
}

// Exported (not module-private) so tests can render it directly and assert
// the sr-only h1 below, mirroring the PortfolioEmptyState/PortfolioErrorState
// export pattern in src/app/portfolio/page.tsx.
export function OnboardingSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            {/* OnboardingGuard reads cookies (getCurrentUser), so this fallback —
                not OnboardingContent's real <h1> — is what's in the document
                outline before the boundary resolves. Same sr-only-duplicate
                technique as src/app/[symbol]/page.tsx: identical text to the
                real h1 below, so there's never zero or two h1s for this page. */}
            <h1 className="sr-only">보유종목을 등록해 보세요</h1>
            <span className="sr-only">불러오는 중이에요</span>
            <div className="space-y-6" aria-hidden="true">
                <div className="space-y-3">
                    <div className="h-6 w-28 animate-pulse rounded-full bg-secondary-800" />
                    <div className="h-7 w-64 animate-pulse rounded bg-secondary-800" />
                    <div className="h-4 w-full max-w-md animate-pulse rounded bg-secondary-800" />
                </div>
                <div className="h-48 animate-pulse rounded-lg bg-secondary-900/80 ring-1 ring-secondary-800" />
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl">
                <Suspense fallback={<OnboardingSkeleton />}>
                    <OnboardingGuard />
                </Suspense>
            </div>
        </main>
    );
}
