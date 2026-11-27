'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { topicToRow } from '@/entities/mail-alert/lib/topics';
import type {
    MailAlertChangeResult,
    MailAlertLinkAuth,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import {
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
} from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import {
    useMailAlertErrorText,
    type MailAlertErrorStatus,
} from '../hooks/useMailAlertErrorText';
import { useMailAlertManage } from '../hooks/useMailAlertManage';
import {
    MailAlertPriceAlerts,
    type MailAlertManageFiredAlert,
    type MailAlertManagePriceAlert,
} from './MailAlertPriceAlerts';

/**
 * 변경 결과에서 사용자에게 알릴 오류만 꺼낸다. 이미 없는 항목(`not_found`)은 그만 받겠다는 목적이 이뤄진
 * 상태라 오류가 아니다.
 */
function errorStatusOf(
    result: MailAlertChangeResult | undefined
): MailAlertErrorStatus | null {
    if (result === undefined) return null;
    return result.status === 'ok' ||
        result.status === 'subscriber_removed' ||
        result.status === 'not_found'
        ? null
        : result.status;
}

/** 서버가 항목마다 번역해 넘기는 표시 이름(종목 코드, 신호 이름, 시장 이름이 든 문장). */
export interface MailAlertManageTopic {
    readonly topic: MailAlertTopic;
    readonly label: string;
}

interface MailAlertManageProps {
    readonly maskedEmail: string;
    readonly topics: readonly MailAlertManageTopic[];
    /** 진행 중인 가격대 알림. 공개 전이거나 없으면 빈 배열이다. */
    readonly priceAlerts: readonly MailAlertManagePriceAlert[];
    /** 최근에 알린 가격대 알림. */
    readonly firedPriceAlerts: readonly MailAlertManageFiredAlert[];
    readonly includePortfolio: boolean | null;
    readonly link?: MailAlertLinkAuth;
}

/**
 * `/email-report/alerts`의 본문: 받는 주소, 항목별 "그만 받기", 가격대 알림(지우기), 보유·관심종목 스위치(회원), 모두 그만 받기
 * (한 번 더 묻는다). 모두 그만 받으면 서버가 신청 정보와 발송 기록을 지운 뒤 완료 문구만 남는다.
 */
export function MailAlertManage({
    maskedEmail,
    topics,
    priceAlerts,
    firedPriceAlerts,
    includePortfolio,
    link,
}: MailAlertManageProps) {
    const t = useTranslations('features.mail-alert');
    const errorText = useMailAlertErrorText();
    const stopAllId = useId();
    const [isConfirmingStopAll, setConfirmingStopAll] = useState(false);
    const manage = useMailAlertManage({
        topics: topics.map(item => item.topic),
        includePortfolio,
        link,
    });
    const labelByTopic = new Map(
        topics.map(item => [
            `${topicToRow(item.topic).kind}:${topicToRow(item.topic).key}`,
            item.label,
        ])
    );

    if (manage.isAllStopped) {
        return (
            <p role="status" className="text-sm text-secondary-200">
                {t('allStopped')}
            </p>
        );
    }
    const removedAlerts = new Set(manage.removedAlertIds);
    const visibleAlerts = priceAlerts.filter(
        alert => !removedAlerts.has(alert.id)
    );
    const visibleFired = firedPriceAlerts.filter(
        alert => !removedAlerts.has(alert.id)
    );
    const failureStatus = [
        manage.remove,
        manage.cancelAlert,
        manage.unsubscribeAll,
        manage.setPortfolio,
    ]
        .map(mutation => errorStatusOf(mutation.data))
        .find(status => status !== null);

    return (
        <div className="space-y-6">
            <p className="text-sm text-secondary-300">
                {t('known', { email: maskedEmail })}
            </p>
            {manage.visibleTopics.length === 0 ? (
                visibleAlerts.length === 0 &&
                visibleFired.length === 0 && (
                    <p className="text-sm text-secondary-400">
                        {t('noTopics')}
                    </p>
                )
            ) : (
                <ul className="divide-y divide-secondary-700">
                    {manage.visibleTopics.map(topic => {
                        const { kind, key } = topicToRow(topic);
                        const label = labelByTopic.get(`${kind}:${key}`) ?? key;
                        const pending =
                            manage.remove.isPending &&
                            manage.remove.variables === topic;
                        return (
                            <li
                                key={`${kind}:${key}`}
                                className="flex items-center justify-between gap-3 py-2"
                            >
                                <span className="text-sm text-secondary-100">
                                    {label}
                                </span>
                                <button
                                    type="button"
                                    aria-label={t('removeTopic', { label })}
                                    aria-disabled={pending}
                                    onClick={() => {
                                        if (!pending)
                                            manage.remove.mutate(topic);
                                    }}
                                    className={cn(
                                        BUTTON_OUTLINE,
                                        'h-11 shrink-0 px-3 text-sm'
                                    )}
                                >
                                    {t('stop')}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <MailAlertPriceAlerts
                alerts={visibleAlerts}
                fired={visibleFired}
                pendingId={
                    manage.cancelAlert.isPending
                        ? (manage.cancelAlert.variables ?? null)
                        : null
                }
                onCancel={alertId => manage.cancelAlert.mutate(alertId)}
            />
            {includePortfolio !== null && (
                <label className="flex items-start gap-2 text-sm text-secondary-300">
                    <input
                        type="checkbox"
                        checked={manage.portfolioOn}
                        aria-disabled={manage.setPortfolio.isPending}
                        onChange={event => {
                            if (!manage.setPortfolio.isPending) {
                                manage.setPortfolio.mutate(
                                    event.target.checked
                                );
                            }
                        }}
                        className="mt-0.5 size-4 accent-primary-600"
                    />
                    <span>{t('includePortfolio')}</span>
                </label>
            )}
            <p
                aria-live="polite"
                className="min-h-5 text-sm text-ui-danger-text"
            >
                {failureStatus === undefined || failureStatus === null
                    ? null
                    : errorText(failureStatus)}
            </p>
            <section
                id="unsubscribe"
                aria-labelledby={stopAllId}
                className="space-y-3 border-t border-secondary-700 pt-4"
            >
                <h2
                    id={stopAllId}
                    className="text-sm font-semibold text-secondary-100"
                >
                    {t('stopAll')}
                </h2>
                {isConfirmingStopAll ? (
                    <div className="space-y-3">
                        <p className="text-sm text-secondary-300">
                            {t('stopAllConfirm')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                aria-disabled={manage.unsubscribeAll.isPending}
                                onClick={() => {
                                    if (!manage.unsubscribeAll.isPending) {
                                        manage.unsubscribeAll.mutate();
                                    }
                                }}
                                className={cn(
                                    BUTTON_OUTLINE_DANGER,
                                    'h-11 px-4 text-sm'
                                )}
                            >
                                {t('stopAllYes')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingStopAll(false)}
                                className={cn(
                                    BUTTON_OUTLINE,
                                    'h-11 px-4 text-sm'
                                )}
                            >
                                {t('cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmingStopAll(true)}
                        className={cn(
                            BUTTON_OUTLINE_DANGER,
                            'h-11 px-4 text-sm'
                        )}
                    >
                        {t('stopAll')}
                    </button>
                )}
            </section>
        </div>
    );
}
