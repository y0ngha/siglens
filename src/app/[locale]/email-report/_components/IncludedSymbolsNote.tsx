import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
    EMAIL_REPORT_MAX_SYMBOLS,
} from '@/entities/email-report/lib/emailReportConstants';
import { REPORT_SYMBOLS_HEADING_ID } from '@/features/email-report-settings/lib/reportSymbolsPreviewIds';
import { ReportSymbolsPreview } from '@/features/email-report-settings/ui/ReportSymbolsPreview';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_INSET, SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { loadReportPreview } from '../_lib/loadReportPreview';

const LINK =
    'font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 수신 대상 미리보기. 폼과 별개의 Suspense 안에서 읽어, DB가 느려도 폼이 먼저 뜬다.
 * 세션은 `getCurrentUser`(React `cache`)가 요청당 한 번만 읽는다. 비회원은 종목을 읽지 않는다
 * (같은 요청의 `EmailReportGuard`가 로그인으로 보낸다).
 */
export async function ReportPreviewLoader() {
    const user = await getCurrentUser();
    return (
        <ReportSymbolsPreview
            preview={user ? await loadReportPreview(user.id) : null}
        />
    );
}

function PreviewSkeleton() {
    return (
        <div aria-hidden="true" className="animate-pulse space-y-4">
            <div className={cn('h-5 w-3/4 rounded', PLACEHOLDER_ON_INSET)} />
            <div className={cn('h-8 rounded-full', PLACEHOLDER_ON_INSET)} />
        </div>
    );
}

/**
 * "리포트에 담기는 종목" 카드 — 고르는 규칙 안내, 현재 대상 미리보기, 관리 화면 링크. 리포트
 * 종목은 관심종목과 보유종목의 합이라 관리 화면 링크도 둘이다.
 */
export function IncludedSymbolsNote() {
    const t = useTranslations('app.email-report');
    return (
        <section
            aria-labelledby={REPORT_SYMBOLS_HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <h2
                id={REPORT_SYMBOLS_HEADING_ID}
                className="text-sm font-semibold text-secondary-100"
            >
                {t('page.190fd1')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('page.a613ae', {
                    v0: EMAIL_REPORT_MAX_SYMBOLS,
                    v1: EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
                })}
            </p>
            <Suspense fallback={<PreviewSkeleton />}>
                <ReportPreviewLoader />
            </Suspense>
            <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <Link href="/watchlist" className={LINK}>
                    {t('page.manageWatchlist')}
                </Link>
                <Link href="/portfolio" className={LINK}>
                    {t('page.managePortfolio')}
                </Link>
            </p>
        </section>
    );
}
