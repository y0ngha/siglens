'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

/** 서버가 알림마다 번역해 넘기는 표시 문구(조건 한 문장과 설명 줄). 가격·날짜 서식은 서버가 입힌다. */
export interface MailAlertManagePriceAlert {
    readonly id: string;
    readonly label: string;
    /** 설명 줄. `key`는 줄의 종류라 한 알림 안에서 겹치지 않는다(같은 문구가 두 줄이어도 키가 다르다). */
    readonly lines: readonly MailAlertManagePriceAlertLine[];
}

/** 알림 설명 한 줄: 기준(무엇을 보고 만들었나), 만든 날과 그때 가격, 확인 기한. */
export interface MailAlertManagePriceAlertLine {
    readonly key: 'basis' | 'created' | 'expires';
    readonly text: string;
}

/** 이미 알린 알림 한 건의 문장. */
export interface MailAlertManageFiredAlert {
    readonly id: string;
    readonly text: string;
}

interface MailAlertPriceAlertsProps {
    readonly alerts: readonly MailAlertManagePriceAlert[];
    readonly fired: readonly MailAlertManageFiredAlert[];
    /** 지우는 중인 알림 id. */
    readonly pendingId: string | null;
    readonly onCancel: (alertId: string) => void;
}

/**
 * 설정 화면의 가격대 알림: 진행 중인 알림(지우기 버튼 포함)과 최근에 알린 알림. 둘 다 없으면 아무것도 그리지
 * 않는다 — 가격대 알림을 만든 적 없는 구독자의 화면은 그대로다.
 */
export function MailAlertPriceAlerts({
    alerts,
    fired,
    pendingId,
    onCancel,
}: MailAlertPriceAlertsProps) {
    const t = useTranslations('features.mail-alert');
    const activeHeadingId = useId();
    const firedHeadingId = useId();
    return (
        <>
            {alerts.length > 0 && (
                <section
                    aria-labelledby={activeHeadingId}
                    className="space-y-2"
                >
                    <h2
                        id={activeHeadingId}
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('priceAlertsHeading')}
                    </h2>
                    <ul className="divide-y divide-secondary-700">
                        {alerts.map(alert => {
                            const pending = pendingId === alert.id;
                            return (
                                <li
                                    key={alert.id}
                                    className="flex items-start justify-between gap-3 py-2"
                                >
                                    <div className="space-y-1">
                                        <p className="text-sm text-secondary-100">
                                            {alert.label}
                                        </p>
                                        {alert.lines.map(line => (
                                            <p
                                                key={line.key}
                                                className="text-xs text-secondary-400"
                                            >
                                                {line.text}
                                            </p>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={t('removePriceAlert', {
                                            label: alert.label,
                                        })}
                                        aria-disabled={pending}
                                        onClick={() => {
                                            if (!pending) onCancel(alert.id);
                                        }}
                                        className={cn(
                                            BUTTON_OUTLINE,
                                            'h-11 shrink-0 px-3 text-sm'
                                        )}
                                    >
                                        {t('deletePriceAlert')}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
            {fired.length > 0 && (
                <section aria-labelledby={firedHeadingId} className="space-y-2">
                    <h2
                        id={firedHeadingId}
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('priceAlertsFiredHeading')}
                    </h2>
                    <ul className="divide-y divide-secondary-700">
                        {fired.map(alert => (
                            <li
                                key={alert.id}
                                className="py-2 text-sm text-secondary-300"
                            >
                                {alert.text}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}
