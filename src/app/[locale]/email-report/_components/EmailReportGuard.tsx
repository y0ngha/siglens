import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { EmailReportSettingsSection } from '@/features/email-report-settings/ui/EmailReportSettingsSection';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { PLACEHOLDER_ON_INSET } from '@/shared/lib/surfaceStyles';
import { localePathToLogin } from '../../_personal/localePathToLogin';

/**
 * 수신 설정 폼의 회원 가드 — 비회원이면 로그인으로 보낸다. 이 경로는 프록시의
 * `AUTH_REQUIRED_PATHS`에 넣지 않는다: 그 목록은 앞부분 일치라 로그인 없이 열려야 하는
 * `/email-report/unsubscribe`·`/email-report/sample`까지 막는다. 쿠키를 읽으므로 페이지의
 * Suspense 안에서 그린다. 카드 껍데기는 페이지의 정적 셸에 있고 여기서는 폼만 그린다 —
 * 미리보기 조회가 폼을 붙잡지 않게.
 */
export async function EmailReportGuard({ locale }: { locale: Locale }) {
    const user = await getCurrentUser();
    if (!user) redirect(localePathToLogin(locale, '/email-report'));
    return <EmailReportSettingsSection />;
}

/** `EmailReportGuard`가 세션을 읽는 동안 설정 카드 안을 채우는 fallback. */
export function EmailReportSettingsSkeleton() {
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
