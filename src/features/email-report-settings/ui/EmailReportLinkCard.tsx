import { useTranslations } from 'next-intl';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

const HEADING_ID = 'email-report-link-card-heading';

/**
 * 계정 설정 화면의 메일 리포트 안내 카드.
 *
 * 수신 설정 폼(`EmailReportSettingsSection`)은 `/email-report` 한 곳에만 둔다. 계정 화면에도
 * 폼을 한 벌 더 그렸더니 같은 설정이 두 화면에 생겨 어느 쪽이 원본인지 헷갈렸다 — 여기서는
 * 설정 화면으로 안내만 한다.
 */
export function EmailReportLinkCard() {
    const t = useTranslations('features.email-report-settings');
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(
                SURFACE_CARD,
                'flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between'
            )}
        >
            <div>
                <h2
                    id={HEADING_ID}
                    className="text-lg font-semibold text-secondary-100"
                >
                    {t('EmailReportLinkCard.heading')}
                </h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('EmailReportLinkCard.description')}
                </p>
            </div>
            <Link
                href="/email-report"
                className={cn(
                    BUTTON_OUTLINE,
                    'h-11 shrink-0 px-5 text-sm font-semibold'
                )}
            >
                {t('EmailReportLinkCard.link')}
            </Link>
        </section>
    );
}
