import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { EMAIL_REPORT_MAX_SYMBOLS } from '@/entities/email-report/lib/emailReportConstants';
import { EmailReportSettingsSection } from '@/features/email-report-settings/ui/EmailReportSettingsSection';
import { localePath, resolveLocale, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { PLACEHOLDER_ON_INSET, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

const PATH = '/email-report';
const LINK =
    'font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 로그인 전용 개인 설정 페이지 — 색인하지 않는다(포트폴리오·계정 설정과 같은 취급). */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const title = tSeo('emailReport.title');
    const description = tSeo('emailReport.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, PATH) },
        ...localePageSocial(locale, PATH, { title, description }),
        robots: { index: false, follow: false },
    };
}

/**
 * 비로그인이면 로그인으로 보낸다. 이 경로는 프록시의 `AUTH_REQUIRED_PATHS`에 넣지 않는다 —
 * 그 목록은 앞부분 일치라 로그인 없이 열려야 하는 `/email-report/unsubscribe`까지 막는다.
 * cookies를 읽으므로 Suspense 안에 둔다(계정 페이지 `AccountContent`와 같은 이유).
 */
export async function EmailReportGuard({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) {
        redirect(
            `${localePath(locale, '/login')}?next=${encodeURIComponent(
                localePath(locale, PATH)
            )}`
        );
    }
    return <EmailReportSettingsSection />;
}

function SettingsSkeleton() {
    return (
        <div aria-hidden="true" className="animate-pulse space-y-4">
            <div className={cn('h-16 rounded-lg', PLACEHOLDER_ON_INSET)} />
            <div
                className={cn('h-10 w-2/3 rounded-lg', PLACEHOLDER_ON_INSET)}
            />
            <div className={cn('h-10 w-40 rounded-lg', PLACEHOLDER_ON_INSET)} />
        </div>
    );
}

function IncludedSymbolsNote() {
    const t = useTranslations('app.email-report');
    return (
        <section
            aria-labelledby="email-report-symbols-heading"
            className="space-y-2 rounded-lg border border-secondary-700 bg-secondary-800/40 p-6"
        >
            <h2
                id="email-report-symbols-heading"
                className="text-sm font-semibold text-secondary-100"
            >
                {t('page.190fd1')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.97c221', { v0: EMAIL_REPORT_MAX_SYMBOLS })}
            </p>
            <p className="text-sm">
                <Link href="/portfolio" className={LINK}>
                    {t('page.513e32')}
                </Link>
            </p>
        </section>
    );
}

export default async function EmailReportPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const t = await getTranslations('app.email-report');
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.411c76')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.c1399c')}
                    </p>
                </header>
                <section
                    aria-label={t('page.b7b3c8')}
                    className={cn(SURFACE_CARD, 'p-6')}
                >
                    <Suspense fallback={<SettingsSkeleton />}>
                        <EmailReportGuard locale={locale} />
                    </Suspense>
                </section>
                <IncludedSymbolsNote />
            </div>
        </main>
    );
}
