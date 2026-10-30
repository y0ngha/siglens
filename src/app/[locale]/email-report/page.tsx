import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resolveLocale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    EmailReportGuard,
    EmailReportSettingsSkeleton,
} from './_components/EmailReportGuard';
import { IncludedSymbolsNote } from './_components/IncludedSymbolsNote';
import { EMAIL_REPORT_PATH } from './_lib/paths';

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
        alternates: { canonical: localeCanonical(locale, EMAIL_REPORT_PATH) },
        ...localePageSocial(locale, EMAIL_REPORT_PATH, { title, description }),
        robots: { index: false, follow: false },
    };
}

/**
 * 메일 리포트 수신 설정 페이지. 머리말·카드 껍데기는 세션과 무관해 먼저 그리고, 회원 가드가 붙은
 * 설정 폼과 대상 종목 미리보기는 각자의 Suspense 안에서 따로 채운다.
 */
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
                        {t('page.b38abd')}
                    </p>
                </header>
                <section
                    aria-label={t('page.b7b3c8')}
                    className={cn(SURFACE_CARD, 'p-6')}
                >
                    <Suspense fallback={<EmailReportSettingsSkeleton />}>
                        <EmailReportGuard locale={locale} />
                    </Suspense>
                </section>
                <IncludedSymbolsNote />
            </div>
        </main>
    );
}
