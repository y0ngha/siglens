import { useTranslations } from 'next-intl';
import { localeCanonical } from '@/shared/lib/seoAlternates';
import { getTranslations } from 'next-intl/server';
import { PositionHoldingCard } from './PositionHoldingCard';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '@/entities/portfolio/lib/toView';
import { getDatabaseClient } from '@/shared/db/client';
import { SITE_NAME } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { PortfolioHoldingView } from '@/entities/portfolio';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup/account/onboarding
// 정책과 일관). 외부에 변형 URL이 공유되더라도 "원본은 /portfolio 하나"라는 신호를
// 명확히 두면 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/portfolio`도 canonical이 `/portfolio`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    return {
        title: '내 포트폴리오 위치',
        description: `${SITE_NAME} 보유종목별 최근 가격 범위 안에서 내 평단이 어디에 있는지 확인하는 개인화 페이지`,
        alternates: { canonical: localeCanonical(resolved, '/portfolio') },
        openGraph: { url: localeCanonical(resolved, '/portfolio') },
        // 로그인 전용 개인화 서페이스라 색인 대상이 아니다 — 비로그인 방문자는
        // 아래에서 /login?next=/portfolio로 리다이렉트된다.
        robots: { index: false, follow: false },
    };
}

/**
 * Reads cookies via getCurrentUser — must be inside Suspense for PPR. Exported
 * (rather than module-private) so tests can `await PortfolioGuard()` directly
 * and assert the unauthenticated redirect target, mirroring the
 * `OnboardingGuard` export pattern in `src/app/onboarding/page.tsx`.
 *
 * Reads the user's holdings directly via `DrizzlePortfolioRepository` (the
 * same repo `getPortfolioHoldingsAction` wraps) instead of calling that
 * action, for two reasons: (1) the action re-resolves `getCurrentUser()`
 * internally, which would resolve the session twice per request; (2) the
 * action deliberately lets a transient DB read failure propagate (it's
 * designed as a React Query `queryFn`, where a thrown error just flips
 * `isError` — see its own doc comment), but here that would hit the *page's*
 * root error boundary instead. The try/catch below degrades to an in-page
 * `PortfolioErrorState` so a transient blip never breaks the whole page.
 *
 * Server cost is still bounded to a single holdings DB read — per-holding
 * price ranges are NEVER fetched here. Each `PositionHoldingCard` lazily
 * fetches its own symbol's bars on the client once scrolled into view, so
 * this dynamic (non-cached) page never fans out into an unbounded N-symbol
 * FMP fetch per visit.
 */
export async function PortfolioGuard({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/portfolio')
            )}`
        );
    }

    let holdings: PortfolioHoldingView[];
    try {
        const { db } = getDatabaseClient();
        const rows = await new DrizzlePortfolioRepository(db).findByUser(
            user.id
        );
        holdings = rows
            .map(toView)
            .toSorted((a, b) => a.symbol.localeCompare(b.symbol));
    } catch {
        return <PortfolioErrorState />;
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
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-empty-state"
            className="flex flex-col items-start gap-3 rounded-xl border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('page.ac9263')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.d103d5')}
            </p>
            <Link
                href="/onboarding"
                className="inline-flex min-h-11 touch-manipulation items-center rounded-lg border border-primary-500 px-4 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/10 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('page.81860c')}
            </Link>
        </section>
    );
}

// Exported (not module-private) for the same reason as `PortfolioEmptyState`
// — tests locate it via `findElementByType` on the unrendered tree returned
// by `PortfolioGuard()` when the holdings read throws.
export function PortfolioErrorState() {
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-error-state"
            className="flex flex-col items-start gap-3 rounded-xl border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('page.90a081')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.92020d')}
            </p>
        </section>
    );
}

function SkeletonCard() {
    return (
        <div
            aria-hidden="true"
            className="h-64 animate-pulse rounded-xl bg-secondary-800/60"
        />
    );
}

function PortfolioSkeleton() {
    const t = useTranslations('app.portfolio');
    return (
        <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            data-testid="portfolio-loading"
        >
            <span className="sr-only">{t('page.605ada')}</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map(i => (
                    <SkeletonCard key={i} />
                ))}
            </div>
        </div>
    );
}

export default async function PortfolioPage({
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
    const t = await getTranslations('app.portfolio');
    return (
        <main className="min-h-[calc(100dvh-3.5rem)] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.55ca69')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.80736f')}
                    </p>
                </header>
                <Suspense fallback={<PortfolioSkeleton />}>
                    <PortfolioGuard locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
