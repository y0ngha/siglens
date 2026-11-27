import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { loadMailAlertManageView } from '@/entities/mail-alert/server/loadMailAlertManageView';
import { resolveLocale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { MailAlertsBody } from '../_components/MailAlertsBody';
import { MAIL_ALERTS_PATH } from '../_lib/mailAlertPaths';
import { readAlertLink } from '../_lib/readAlertLink';

// 세션·쿠키·서명 링크로 소유자를 정하는 개인 화면이라 요청마다 렌더한다(ISR 대상이 아니다).
export const dynamic = 'force-dynamic';

/** 개인 설정 화면 — 색인하지 않고 사이트맵에도 넣지 않는다(메일 리포트 설정과 같은 취급). */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const t = await getTranslations({
        locale,
        namespace: 'app.email-report.alerts',
    });
    const title = t('page.title');
    const description = t('page.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, MAIL_ALERTS_PATH) },
        ...localePageSocial(locale, MAIL_ALERTS_PATH, { title, description }),
        robots: { index: false, follow: false },
    };
}

/**
 * 알림 메일 설정 페이지. 소유자는 세션(회원) → 메일 속 서명 링크(`?s=&sig=`) → 같은 브라우저의 쿠키
 * 순으로 서버가 정한다. 알아보지 못하면 "메일 속 링크로 열어 주세요" 안내만 나온다.
 */
export default async function MailAlertsPage({
    params,
    searchParams,
}: {
    readonly params: Promise<{ locale: string }>;
    readonly searchParams: Promise<{
        s?: string | string[];
        sig?: string | string[];
    }>;
}) {
    const { locale: rawLocale } = await params;
    enterLocale(rawLocale);
    const link = readAlertLink(await searchParams);
    const [t, load] = await Promise.all([
        getTranslations('app.email-report.alerts'),
        loadMailAlertManageView(link),
    ]);
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('page.title')}
                    </h1>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('page.subtitle')}
                    </p>
                </header>
                <section
                    aria-label={t('page.title')}
                    className={cn(SURFACE_CARD, 'p-6')}
                >
                    <MailAlertsBody
                        load={load}
                        link={link}
                        locale={resolveLocale(rawLocale)}
                    />
                </section>
            </div>
        </main>
    );
}
