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

function OnboardingSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">불러오는 중이에요</span>
            <div className="space-y-6" aria-hidden="true">
                <div className="space-y-3">
                    <div className="bg-secondary-800 h-6 w-28 animate-pulse rounded-full" />
                    <div className="bg-secondary-800 h-7 w-64 animate-pulse rounded" />
                    <div className="bg-secondary-800 h-4 w-full max-w-md animate-pulse rounded" />
                </div>
                <div className="ring-secondary-800 bg-secondary-900/80 h-48 animate-pulse rounded-2xl ring-1" />
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <main className="bg-secondary-950 min-h-[calc(100dvh-3.5rem)] px-4 py-12">
            <div className="mx-auto w-full max-w-2xl">
                <Suspense fallback={<OnboardingSkeleton />}>
                    <OnboardingGuard />
                </Suspense>
            </div>
        </main>
    );
}
