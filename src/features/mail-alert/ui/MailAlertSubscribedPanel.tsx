'use client';

import { useTranslations } from 'next-intl';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useMailAlertErrorText } from '../hooks/useMailAlertErrorText';
import { useMailAlertTopicChange } from '../hooks/useMailAlertTopicChange';

interface MailAlertSubscribedPanelProps {
    readonly topic: MailAlertTopic;
    readonly maskedEmail: string;
}

/** 이 항목을 이미 받고 있을 때: 상태와 "그만 받기", 설정 화면 링크. */
export function MailAlertSubscribedPanel({
    topic,
    maskedEmail,
}: MailAlertSubscribedPanelProps) {
    const t = useTranslations('features.mail-alert');
    const errorText = useMailAlertErrorText();
    const { remove } = useMailAlertTopicChange(topic);
    const result = remove.data;
    const stopped =
        result?.status === 'ok' || result?.status === 'subscriber_removed';

    return (
        <div className="space-y-3 text-sm text-secondary-200">
            <div role="status" className="space-y-1">
                {stopped ? (
                    <p>{t('stopped')}</p>
                ) : (
                    <>
                        <p>{t('subscribed')}</p>
                        <p className="text-secondary-400">
                            {t('known', { email: maskedEmail })}
                        </p>
                    </>
                )}
            </div>
            {!stopped && (
                <button
                    type="button"
                    aria-disabled={remove.isPending}
                    onClick={() => {
                        if (!remove.isPending) remove.mutate();
                    }}
                    className={cn(BUTTON_OUTLINE, 'h-11 w-full px-4 text-sm')}
                >
                    {t('stop')}
                </button>
            )}
            <p
                aria-live="polite"
                className="min-h-5 text-sm text-ui-danger-text"
            >
                {result === undefined || stopped
                    ? null
                    : errorText(result.status)}
            </p>
            <Link
                href="/email-report/alerts"
                prefetch={false}
                className="text-primary-400 underline underline-offset-2 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('manage')}
            </Link>
        </div>
    );
}
