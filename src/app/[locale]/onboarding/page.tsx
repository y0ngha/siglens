import { useTranslations } from 'next-intl';
import { OnboardingContent } from '@/features/portfolio-onboarding';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { setRequestLocale } from 'next-intl/server';
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
export async function OnboardingGuard({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/onboarding')
            )}`
        );
    }
    return <OnboardingContent />;
}

// Exported (not module-private) so tests can render it directly and assert
// the sr-only h1 below, mirroring the PortfolioEmptyState/PortfolioErrorState
// export pattern in src/app/portfolio/page.tsx.
export function OnboardingSkeleton() {
    const t = useTranslations('app.onboarding');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            {/* OnboardingGuard reads cookies (getCurrentUser), so this fallback —
                not OnboardingContent's real <h1> — is what's in the document
                outline before the boundary resolves. Same sr-only-duplicate
                technique as src/app/[symbol]/page.tsx: identical text to the
                real h1 below, so there's never zero or two h1s for this page. */}
            <h1 className="sr-only">{t('page.26bd1f')}</h1>
            <span className="sr-only">{t('page.b1e428')}</span>
            <div className="space-y-6" aria-hidden="true">
                <div className="space-y-3">
                    <div className="h-6 w-28 animate-pulse rounded-full bg-secondary-800" />
                    <div className="h-7 w-64 animate-pulse rounded bg-secondary-800" />
                    <div className="h-4 w-full max-w-md animate-pulse rounded bg-secondary-800" />
                </div>
                <div className="h-48 animate-pulse rounded-2xl bg-secondary-900/80 ring-1 ring-secondary-800" />
            </div>
        </div>
    );
}

export default async function OnboardingPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    return (
        <main className="min-h-[calc(100dvh-3.5rem)] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl">
                <Suspense fallback={<OnboardingSkeleton />}>
                    <OnboardingGuard locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
