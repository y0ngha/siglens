import { useTranslations } from 'next-intl';
import { isMailAlertLaunched } from '@/entities/mail-alert/lib/mailAlertConstants';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { MAIL_ALERTS_PATH } from '../_lib/mailAlertPaths';

/**
 * 메일 리포트 설정에서 알림 메일 설정으로 가는 링크 행. 공개 전에는 그리지 않는다.
 */
export function MailAlertsLinkRow() {
    const t = useTranslations('app.email-report');
    if (!isMailAlertLaunched()) return null;
    return (
        <Link
            href={MAIL_ALERTS_PATH}
            prefetch={false}
            className={cn(
                SURFACE_CARD,
                'block p-5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
            )}
        >
            <span className="block text-sm font-semibold text-secondary-100">
                {t('alertsLink.title')}
            </span>
            <span className="mt-1 block text-sm text-secondary-400">
                {t('alertsLink.description')}
            </span>
        </Link>
    );
}
