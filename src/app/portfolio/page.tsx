import { PositionHoldingCard } from './PositionHoldingCard';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getPortfolioHoldingsAction } from '@/entities/portfolio/actions';
import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup/account/onboarding
// 정책과 일관). 외부에 변형 URL이 공유되더라도 "원본은 /portfolio 하나"라는 신호를
// 명확히 두면 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
export const metadata: Metadata = {
    title: '내 포트폴리오 위치',
    description: `${SITE_NAME} 보유종목별 최근 가격 범위 안에서 내 평단이 어디에 있는지 확인하는 개인화 페이지`,
    alternates: { canonical: `${SITE_URL}/portfolio` },
    openGraph: { url: `${SITE_URL}/portfolio` },
    robots: { index: false, follow: false },
};

/**
 * Reads cookies via getCurrentUser/getPortfolioHoldingsAction — must be inside
 * Suspense for PPR. Exported (rather than module-private) so tests can `await
 * PortfolioGuard()` directly and assert the unauthenticated redirect target,
 * mirroring the `OnboardingGuard` export pattern in `src/app/onboarding/page.tsx`.
 *
 * Server cost is bounded to a single holdings DB read (`findByUser`, via
 * `getPortfolioHoldingsAction`) — per-holding price ranges are NEVER fetched
 * here. Each `PositionHoldingCard` lazily fetches its own symbol's bars on the
 * client once scrolled into view, so this dynamic (non-cached) page never fans
 * out into an unbounded N-symbol FMP fetch per visit.
 */
export async function PortfolioGuard() {
    const [user, holdings] = await Promise.all([
        getCurrentUser(),
        getPortfolioHoldingsAction(),
    ]);
    if (!user) {
        redirect('/login?next=/portfolio');
    }

    if (holdings.length === 0) {
        return <PortfolioEmptyState />;
    }

    return (
        <div
            data-testid="portfolio-holding-grid"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
            {holdings.map(holding => (
                <PositionHoldingCard key={holding.symbol} holding={holding} />
            ))}
        </div>
    );
}

// Exported (not module-private) so tests can locate it in the unrendered
// element tree returned by `PortfolioGuard()` via `findElementByType`,
// mirroring the `countElementsByType(tree, PositionHoldingCard)` check above.
export function PortfolioEmptyState() {
    return (
        <section
            data-testid="portfolio-empty-state"
            className="border-secondary-700 bg-secondary-800/40 flex flex-col items-start gap-3 rounded-xl border p-6"
        >
            <p className="text-secondary-100 text-sm font-semibold">
                아직 등록한 보유종목이 없어요
            </p>
            <p className="text-secondary-400 text-sm leading-relaxed">
                보유종목을 등록하면 최근 가격 범위 안에서 내 평단이 어디에
                있는지 종목별 빌딩으로 확인할 수 있어요.
            </p>
            <Link
                href="/onboarding"
                className="border-primary-500 text-primary-300 hover:bg-primary-500/10 focus-visible:ring-primary-500 inline-flex min-h-11 touch-manipulation items-center rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                보유종목 등록해보기
            </Link>
        </section>
    );
}

function SkeletonCard() {
    return (
        <div
            aria-hidden="true"
            className="bg-secondary-800/60 h-64 animate-pulse rounded-xl"
        />
    );
}

function PortfolioSkeleton() {
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="portfolio-loading"
        >
            <span className="sr-only">보유종목 위치를 불러오는 중이에요</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map(i => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
}

export default function PortfolioPage() {
    return (
        <main className="bg-secondary-950 min-h-[calc(100dvh-3.5rem)] px-4 py-12">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header>
                    <h1 className="text-secondary-50 text-2xl font-semibold">
                        내 포트폴리오 위치
                    </h1>
                    <p className="text-secondary-400 mt-1 text-sm">
                        보유종목별 최근 가격 범위에서 내 평단이 어디에 있는지
                        확인하세요.
                    </p>
                </header>
                <Suspense fallback={<PortfolioSkeleton />}>
                    <PortfolioGuard />
                </Suspense>
            </div>
        </main>
    );
}
