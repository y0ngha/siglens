import { useTranslations } from 'next-intl';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { getTranslations } from 'next-intl/server';
import { ApiKeySection } from '@/features/api-key-management';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { setRequestLocale } from 'next-intl/server';
import { PortfolioSection } from '@/features/portfolio-management';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getRegisteredProvidersAction } from '@/entities/api-key/actions';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// noindex 페이지에도 canonical/og:url을 명시한다 (login/signup 정책과 일관).
// 외부에 변형 URL이 공유되더라도 "원본은 /account 하나"라는 신호를 명확히 두면
// 일부 크롤러/공유 도구가 변형을 강조하지 않는다.
/**
 * 정적 `metadata`가 아니라 `generateMetadata`인 이유: 정적 객체는 로케일을 볼 수
 * 없어 `/en/account`도 canonical이 `/account`(한국어)로 나갔다. noindex 페이지에
 * 다른 URL을 canonical로 걸면 Google이 noindex를 그 대상으로 전파할 수 있다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    const title = tSeo('account.title');
    const description = tSeo('account.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(resolved, '/account') },
        ...localePageSocial(resolved, '/account', {
            title,
            description,
        }),
        robots: { index: false, follow: false },
    };
}

// Reads cookies via getCurrentUser — must be inside Suspense for PPR.
async function AccountContent({ locale }: { locale: Locale }) {
    const t = await getTranslations('app.account');
    const [user, rawProviders] = await Promise.all([
        getCurrentUser(),
        getRegisteredProvidersAction(),
    ]);
    if (!user) {
        // 로케일을 유지한다 — 영어 사용자가 한국어 로그인 페이지로 떨어지면 안 된다.
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, '/account')
            )}`
        );
    }
    const registeredProviders = rawProviders.map(({ provider }) => provider);
    return (
        <>
            <section
                aria-label={t('page.14fab1')}
                className="space-y-4 rounded-2xl bg-secondary-900/80 p-6 ring-1 ring-secondary-800 backdrop-blur-xl"
            >
                <h2 className="text-lg font-semibold text-secondary-100">
                    {t('page.14fab1')}
                </h2>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[120px_1fr]">
                    <dt className="text-secondary-400">{t('page.3c3776')}</dt>
                    <dd className="break-all text-secondary-100">
                        {user.email}
                    </dd>
                    <dt className="text-secondary-400">{t('page.7be993')}</dt>
                    <dd className="text-secondary-100">
                        {user.name ?? (
                            <span className="text-secondary-500">
                                {t('page.c6c674')}
                            </span>
                        )}
                    </dd>
                    <dt className="text-secondary-400">{t('page.f5162c')}</dt>
                    <dd className="text-secondary-100">
                        {TIER_LABEL[user.tier]}
                    </dd>
                </dl>
            </section>

            <section
                aria-label={t('page.64f90b')}
                className="space-y-4 rounded-2xl bg-secondary-900/80 p-6 ring-1 ring-secondary-800 backdrop-blur-xl"
            >
                <ApiKeySection registeredProviders={registeredProviders} />
            </section>

            <section
                aria-label={t('page.cae421')}
                className="space-y-4 rounded-2xl bg-secondary-900/80 p-6 ring-1 ring-secondary-800 backdrop-blur-xl"
            >
                <PortfolioSection />
                <Link
                    href="/portfolio"
                    className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-md border border-secondary-700 px-4 text-sm font-medium text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('page.2a5883')}
                </Link>
            </section>

            <section
                aria-label={t('page.1987ac')}
                className="space-y-4 rounded-2xl border border-ui-danger/30 bg-ui-danger/5 p-6"
            >
                <div className="flex flex-col gap-3 rounded-lg border border-secondary-800 bg-secondary-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-secondary-100">
                            {t('page.3a0c2b')}
                        </h3>
                        <p className="mt-1 text-sm text-secondary-400">
                            {t('page.54ac38')}
                        </p>
                    </div>
                    <Link
                        href="/account/delete"
                        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-ui-danger/40 px-5 text-sm font-semibold text-ui-danger transition-colors hover:bg-ui-danger/10 focus-visible:ring-2 focus-visible:ring-ui-danger focus-visible:outline-none"
                    >
                        {t('page.fa7c86')}
                    </Link>
                </div>
            </section>
        </>
    );
}

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded bg-secondary-800 ${className ?? ''}`}
        />
    );
}

function AccountContentSkeleton() {
    const t = useTranslations('app.account');
    return (
        <>
            {/* 프로필 섹션 */}
            <section
                aria-label={t('page.c4079e')}
                className="space-y-4 rounded-2xl bg-secondary-900/80 p-6 ring-1 ring-secondary-800 backdrop-blur-xl"
            >
                <SkeletonLine className="h-6 w-16" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                    <SkeletonLine className="h-4 w-12" />
                    <SkeletonLine className="h-4 w-48" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-24" />
                    <SkeletonLine className="h-4 w-16" />
                    <SkeletonLine className="h-4 w-16" />
                </div>
            </section>

            {/* AI 모델 API 키 섹션 */}
            <section
                aria-label={t('page.1b6c6d')}
                className="space-y-4 rounded-2xl bg-secondary-900/80 p-6 ring-1 ring-secondary-800 backdrop-blur-xl"
            >
                <SkeletonLine className="h-6 w-32" />
                <SkeletonLine className="h-4 w-64" />
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="rounded-xl bg-secondary-900/60 p-4 ring-1 ring-secondary-800"
                    >
                        <div className="flex items-center gap-2">
                            <SkeletonLine className="h-4 w-20" />
                            <SkeletonLine className="h-5 w-12 rounded-full" />
                        </div>
                    </div>
                ))}
            </section>
        </>
    );
}

export default async function AccountPage({
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
    const t = await getTranslations('app.account');
    return (
        <main className="min-h-[calc(100dvh-3.5rem)] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.622fae')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.b8fd1b')}
                    </p>
                </header>
                <Suspense fallback={<AccountContentSkeleton />}>
                    <AccountContent locale={locale} />
                </Suspense>
            </div>
        </main>
    );
}
