/** 가이드 라우트가 카탈로그를 못 읽었을 때의 안내 뷰. */
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { GuidePageHeader } from './ui/GuidePageHeader';

interface GuideUnavailablePageProps {
    readonly locale: Locale;
}

/**
 * 가이드 본문을 DB에서 읽지 못한 렌더(DB 없는 배포 빌드·마이그레이션 전·DB 오류·시드 전)의 안내.
 *
 * 404도 빈 화면도 아니다 — 비어 있지 않은 안내를 내고, 라우트가 짧은 revalidate와 noindex 메타를
 * 함께 건다. 그래서 이 HTML이 ISR 캐시에 굳더라도 곧 실데이터로 재생성되고 색인되지 않는다.
 */
export async function GuideUnavailablePage({
    locale,
}: GuideUnavailablePageProps) {
    const t = await getTranslations({ locale, namespace: 'views.guide' });
    return (
        <main className="page-container flex flex-1 flex-col py-8 sm:py-12">
            <Breadcrumb trail={[{ label: t('hubTitle') }]} />
            <GuidePageHeader title={t('hubTitle')} />
            <div className="my-8 max-w-2xl rounded-lg border border-ui-warning/30 bg-ui-warning/5 p-5">
                <p className="text-sm font-semibold text-secondary-100">
                    {t('unavailableTitle')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-secondary-300">
                    {t('unavailableBody')}
                </p>
            </div>
            <p>
                <LocaleLink
                    href="/"
                    prefetch={false}
                    className={cn(BUTTON_OUTLINE, 'min-h-11 px-5 text-sm')}
                >
                    {t('unavailableHome')}
                </LocaleLink>
            </p>
        </main>
    );
}
