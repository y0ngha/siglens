import { useTranslations } from 'next-intl';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { getTranslations } from 'next-intl/server';
import { PositionHoldingCard } from '@/widgets/portfolio-position/ui/PositionHoldingCard';
import { PortfolioManager } from './PortfolioManager';
import { WatchlistManager } from './WatchlistManager';
import { PortfolioSignupCta } from '@/features/portfolio-management/ui/PortfolioSignupCta';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_INSET, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { toView } from '@/entities/portfolio/lib/toView';
import { getDatabaseClient } from '@/shared/db/client';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { resolveLocale } from '@/shared/i18n/locales';
import type { Locale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup/account
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
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const title = tSeo('portfolio.title');
    const description = tSeo('portfolio.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/portfolio') },
        ...localePageSocial(locale, '/portfolio', {
            title,
            description,
        }),
        // 개인화 서페이스라 색인 대상이 아니다 — 비회원도 열리지만 내용(로컬 관심종목)이
        // 방문자마다 다르다.
        robots: { index: false, follow: false },
    };
}

/**
 * `PortfolioManager`는 `useSearchParams()`(`?symbol=`)를 읽는 클라이언트
 * 컴포넌트라 Suspense 경계가 필요하다 — 없으면 이 정적 페이지 전체가 dynamic으로
 * 강등된다(빌드 route 표에서 `●`/PPR → `ƒ`). 감싸는 `<section>`이 이미
 * border/bg/padding을 갖고 있으므로 이 스켈레톤은 내부 블록만 채운다.
 */
function PortfolioManagerSkeleton() {
    return (
        <div aria-hidden="true" className="animate-pulse space-y-4">
            <div className="space-y-2">
                <div className={cn('h-5 w-28 rounded', PLACEHOLDER_ON_INSET)} />
                <div className={cn('h-4 w-56 rounded', PLACEHOLDER_ON_INSET)} />
            </div>
            <div className={cn('h-14 rounded-lg', PLACEHOLDER_ON_INSET)} />
            <div className={cn('h-10 rounded-lg', PLACEHOLDER_ON_INSET)} />
        </div>
    );
}

/**
 * 회원 영역. `getCurrentUser()`(쿠키 읽기)를 **한 번** 읽으므로 반드시 Suspense 안에서
 * 그려야 PPR이 유지된다. 비회원에게는 가입 CTA 카드를, 회원에게는 보유종목 관리 폼과
 * 위치 카드 그리드를 그린다. 비회원도 이 페이지에 들어온다 — 프록시 가드와 페이지
 * `redirect`를 모두 뺐다(관심종목은 가입 전에도 본다, 설계 §6.3). 비회원은 보유 DB를
 * 읽지 않는다. 테스트가 `await PortfolioMemberArea()`로 직접 검증하도록 export한다
 * (`AccountContent` 패턴과 같다).
 *
 * 보유 목록은 `getPortfolioHoldingsAction`이 아니라 `DrizzlePortfolioRepository`로 직접
 * 읽는다: (1) 액션은 `getCurrentUser()`를 다시 풀어 요청당 세션을 두 번 해석하고, (2) 액션은
 * 일시적 DB 실패를 React Query `queryFn`용으로 그대로 던지는데 여기서는 페이지 루트 에러
 * 바운더리로 번진다. 아래 try/catch가 페이지 안 `PortfolioErrorState`로 degrade시킨다.
 *
 * 서버 비용은 보유 DB 읽기 1회로 묶인다 — 종목별 가격 범위는 여기서 가져오지 않는다. 각
 * `PositionHoldingCard`가 뷰포트에 들어올 때 자기 종목의 봉을 클라이언트에서 지연 로드하므로
 * 이 동적 페이지가 방문마다 N-symbol FMP 팬아웃을 일으키지 않는다.
 */
export async function PortfolioMemberArea({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) return <PortfolioSignupCta />;

    const t = await getTranslations({ locale, namespace: 'app.portfolio' });
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

    return (
        <>
            <section
                aria-label={t('page.06c7de')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <Suspense fallback={<PortfolioManagerSkeleton />}>
                    <PortfolioManager />
                </Suspense>
            </section>
            <section
                aria-labelledby="portfolio-positions-heading"
                className="space-y-4"
            >
                <h2
                    id="portfolio-positions-heading"
                    className={HEADING_SECTION}
                >
                    {t('page.55ca69')}
                </h2>
                {holdings.length === 0 ? (
                    <PortfolioEmptyState />
                ) : (
                    <div
                        data-testid="portfolio-holding-grid"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {holdings.map(holding => (
                            <PositionHoldingCard
                                key={holding.symbol}
                                holding={holding}
                            />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

// Exported (not module-private) so tests can locate it in the unrendered
// element tree returned by `PortfolioMemberArea()` via `findElementByType`,
// mirroring the `countElementsByType(tree, PositionHoldingCard)` check above.
export function PortfolioEmptyState() {
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-empty-state"
            className="flex flex-col items-start gap-3 rounded-lg border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('page.ac9263')}
            </p>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.d103d5')}
            </p>
        </section>
    );
}

// Exported (not module-private) for the same reason as `PortfolioEmptyState`
// — tests locate it via `findElementByType` on the unrendered tree returned
// by `PortfolioMemberArea()` when the holdings read throws.
export function PortfolioErrorState() {
    const t = useTranslations('app.portfolio');
    return (
        <section
            data-testid="portfolio-error-state"
            className="flex flex-col items-start gap-3 rounded-lg border border-secondary-700 bg-secondary-800/40 p-6"
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
            className={cn(
                'h-64 animate-pulse rounded-lg',
                PLACEHOLDER_ON_INSET
            )}
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
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.portfolio');
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.title')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.subtitle')}
                    </p>
                </header>
                <Suspense fallback={<PortfolioSkeleton />}>
                    <PortfolioMemberArea locale={locale} />
                </Suspense>
                <section
                    aria-labelledby="portfolio-watchlist-heading"
                    className="space-y-4"
                >
                    <h2
                        id="portfolio-watchlist-heading"
                        className={HEADING_SECTION}
                    >
                        {t('page.watchlistHeading')}
                    </h2>
                    <WatchlistManager />
                </section>
            </div>
        </main>
    );
}
