'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    EXTREME_ZONE_REENTRY_GAP,
    FEAR_GREED_LABEL_CUTOFFS,
} from '@y0ngha/siglens-core';
import { MAIL_ALERT_SEND_HOURS_KST } from '@/entities/mail-alert/lib/mailAlertConstants';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { BUTTON_GHOST } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { useMailAlertState } from '../hooks/useMailAlertState';
import { MailAlertAddPanel } from './MailAlertAddPanel';
import { MailAlertGuestForm } from './MailAlertGuestForm';
import { MailAlertSubscribedPanel } from './MailAlertSubscribedPanel';

interface MailAlertDialogProps {
    readonly topic: MailAlertTopic;
    /** 화면이 번역한 제목(종목명·시장·신호 이름이 이미 들어 있다). */
    readonly title: string;
    readonly onClose: () => void;
}

/** 첫 발송 시각부터 마지막 재시도 슬롯의 한 시간 뒤까지가 "아침 N시에서 M시 사이"다. */
const SEND_FROM_HOUR = MAIL_ALERT_SEND_HOURS_KST[0];
const SEND_TO_HOUR = MAIL_ALERT_SEND_HOURS_KST[1] + 1;

/**
 * 메일로 받기 대화상자. 열리면(마운트) 이 화면 항목의 상태를 서버에서 읽어 알맞은 패널을 보인다:
 * 코드 확인이 필요한 처음 신청, 코드 없이 받는 회원·같은 브라우저, 이미 받고 있음. 공포 탐욕 화면이면
 * 발송 규칙(점수 기준과 재진입 간격)도 함께 안내한다.
 */
export function MailAlertDialog({
    topic,
    title,
    onClose,
}: MailAlertDialogProps) {
    const t = useTranslations('features.mail-alert');
    const titleId = useId();
    const descriptionId = useId();
    const [useOtherEmail, setUseOtherEmail] = useState(false);
    const { data, isPending, isError } = useMailAlertState(topic);

    return (
        <ModalShell
            titleId={titleId}
            descriptionId={descriptionId}
            onClose={onClose}
            focusPanel
            busy={isPending}
            className="max-w-md bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <h2
                id={titleId}
                className="text-lg font-semibold text-balance text-secondary-50"
            >
                {title}
            </h2>
            <div
                id={descriptionId}
                className="mt-2 space-y-1 text-sm leading-relaxed text-secondary-400"
            >
                <p>
                    {t('schedule', {
                        from: SEND_FROM_HOUR,
                        to: SEND_TO_HOUR,
                    })}
                </p>
                {topic.kind === 'fear_greed' && (
                    <p>
                        {t('fearGreedRule', {
                            fear: FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX,
                            greed: FEAR_GREED_LABEL_CUTOFFS.GREED_MAX,
                            gap: EXTREME_ZONE_REENTRY_GAP,
                        })}
                    </p>
                )}
            </div>
            <div className="mt-5">
                {isPending && <p role="status">{t('loading')}</p>}
                {(isError || data?.status === 'unavailable') && (
                    <p role="alert" className="text-sm text-ui-danger-text">
                        {t('errUnavailable')}
                    </p>
                )}
                {data?.status === 'new' && (
                    <MailAlertGuestForm
                        topic={topic}
                        accountEmail={data.accountEmail}
                    />
                )}
                {(data?.status === 'member' || data?.status === 'known') &&
                    (useOtherEmail ? (
                        <MailAlertGuestForm topic={topic} accountEmail={null} />
                    ) : (
                        <MailAlertAddPanel
                            topic={topic}
                            state={data}
                            onOtherEmail={() => setUseOtherEmail(true)}
                        />
                    ))}
                {data?.status === 'subscribed' && (
                    <MailAlertSubscribedPanel
                        topic={topic}
                        maskedEmail={data.maskedEmail}
                    />
                )}
            </div>
            <div className="mt-4 flex justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, 'min-h-11 px-3 text-sm')}
                >
                    {t('close')}
                </button>
            </div>
        </ModalShell>
    );
}
