import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { UnsubscribeConfirm } from '@/features/email-report-unsubscribe/ui/UnsubscribeConfirm';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { AuthCardShell } from '@/shared/ui/auth/AuthCardShell';
import { AuthFormSkeleton } from '@/shared/ui/auth/AuthFormSkeleton';

const PATH = '/email-report/unsubscribe';

/**
 * 메일 수신거부 확인 페이지 — 메일 링크로만 들어오는 유틸리티 페이지라 색인하지 않고
 * 사이트맵·내비에도 넣지 않는다(비밀번호 재설정 페이지와 같은 취급). og·twitter도 이 페이지
 * 값으로 채운다 — 비워 두면 루트 레이아웃의 홈 og:url·제목을 그대로 상속해 링크 미리보기가
 * 홈 카드로 나간다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const t = await getTranslations({
        locale,
        namespace: 'app.email-report.unsubscribe',
    });
    const title = t('page.title');
    const description = t('page.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, PATH) },
        ...localePageSocial(locale, PATH, { title, description }),
        robots: { index: false, follow: false },
    };
}

/**
 * 수신거부 확인 화면. 쿼리(u, sig)는 `UnsubscribeConfirm`('use client')에서만 읽어 이 라우트는
 * 정적으로 남는다.
 */
export default async function EmailReportUnsubscribePage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    enterLocale(locale);
    const t = await getTranslations('app.email-report.unsubscribe');
    return (
        <AuthCardShell title={t('page.title')} subtitle={t('page.subtitle')}>
            <Suspense fallback={<AuthFormSkeleton rows={1} />}>
                <UnsubscribeConfirm />
            </Suspense>
        </AuthCardShell>
    );
}
