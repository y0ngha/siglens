'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useMailAlertErrorText } from '../hooks/useMailAlertErrorText';
import { useMailAlertTopicChange } from '../hooks/useMailAlertTopicChange';
import { MailAlertSuccess } from './MailAlertSuccess';

type AddPanelState =
    | {
          readonly status: 'member';
          readonly maskedEmail: string;
          readonly includePortfolio: boolean;
      }
    | { readonly status: 'known'; readonly maskedEmail: string };

interface MailAlertAddPanelProps {
    readonly topic: MailAlertTopic;
    readonly state: AddPanelState;
    /** `known`일 때만 — 같은 브라우저의 주소 말고 다른 주소로 코드를 받으러 간다. */
    readonly onOtherEmail: () => void;
}

/**
 * 코드 없이 받는 두 경우. 회원(`member`)은 계정 주소로 한 번에 받고, 보유·관심종목 함께 받기가 아직 꺼져
 * 있으면 체크박스를 보인다. 같은 브라우저에서 신청한 적이 있으면(`known`) 그 주소로 이 항목만 더한다.
 */
export function MailAlertAddPanel({
    topic,
    state,
    onOtherEmail,
}: MailAlertAddPanelProps) {
    const t = useTranslations('features.mail-alert');
    const errorText = useMailAlertErrorText();
    const { add } = useMailAlertTopicChange(topic);
    const [includePortfolio, setIncludePortfolio] = useState(false);
    const result = add.data;

    if (result?.status === 'subscribed') {
        return (
            <MailAlertSuccess
                maskedEmail={result.maskedEmail}
                offerSignup={false}
            />
        );
    }
    return (
        <div className="space-y-3">
            <p className="text-sm text-secondary-200">
                {state.status === 'member'
                    ? t('member', { email: state.maskedEmail })
                    : t('known', { email: state.maskedEmail })}
            </p>
            {state.status === 'member' && !state.includePortfolio && (
                <label className="flex items-start gap-2 text-sm text-secondary-300">
                    <input
                        type="checkbox"
                        checked={includePortfolio}
                        onChange={event =>
                            setIncludePortfolio(event.target.checked)
                        }
                        className="mt-0.5 size-4 accent-primary-600"
                    />
                    <span>{t('includePortfolio')}</span>
                </label>
            )}
            <button
                type="button"
                aria-disabled={add.isPending}
                onClick={() => {
                    if (!add.isPending) add.mutate({ includePortfolio });
                }}
                className={cn(BUTTON_PRIMARY, 'h-11 w-full px-4 text-sm')}
            >
                {state.status === 'member' ? t('receive') : t('addThis')}
            </button>
            {state.status === 'known' && (
                <button
                    type="button"
                    onClick={onOtherEmail}
                    className={cn(BUTTON_OUTLINE, 'h-11 w-full px-4 text-sm')}
                >
                    {t('otherEmail')}
                </button>
            )}
            <p
                aria-live="polite"
                className="min-h-5 text-sm text-ui-danger-text"
            >
                {result === undefined ? null : errorText(result.status)}
            </p>
        </div>
    );
}
