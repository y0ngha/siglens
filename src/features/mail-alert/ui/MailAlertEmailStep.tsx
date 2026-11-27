'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { MailAlertRequestCodeState } from '@/entities/mail-alert/model';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useMailAlertErrorText } from '../hooks/useMailAlertErrorText';
import { MailAlertField } from './MailAlertField';
import { MailAlertNotice } from './MailAlertNotice';

interface MailAlertEmailStepProps {
    /** 폼의 `action`(코드 받기 서버 액션을 감싼 것). */
    readonly action: (formData: FormData) => void;
    readonly isPending: boolean;
    readonly state: MailAlertRequestCodeState;
    /** 입력 칸의 처음 값 — 다시 돌아왔을 때는 방금 쓴 주소, 인증 전 회원은 계정 주소. */
    readonly defaultEmail: string;
    /** 인증 전 회원의 계정 주소는 바꿀 수 없다. */
    readonly emailLocked: boolean;
    readonly honeypotField: string;
    /** 제출할 때마다(결과가 오기 전에) 불린다 — 코드 단계에서 돌아온 화면을 닫는다. */
    readonly onSubmit: () => void;
}

/**
 * 1단계: 이메일 주소. 봇 함정 입력은 화면 밖에 두어(`aria-hidden`, 탭 순서 제외) 사람은 건드리지 않는다.
 * 오류가 새로 오면 주소 칸에 포커스를 옮겨 오류 문구가 읽히게 한다(AX-5) — 마운트 때는 옮기지 않는다.
 */
export function MailAlertEmailStep({
    action,
    isPending,
    state,
    defaultEmail,
    emailLocked,
    honeypotField,
    onSubmit,
}: MailAlertEmailStepProps) {
    const t = useTranslations('features.mail-alert');
    const errorText = useMailAlertErrorText();
    const inputRef = useRef<HTMLInputElement>(null);
    const errorStatus =
        state.status === 'invalid_email' ||
        state.status === 'rate_limited' ||
        state.status === 'unavailable'
            ? state.status
            : null;

    useEffect(() => {
        if (errorStatus !== null) inputRef.current?.focus();
    }, [state, errorStatus]);

    return (
        <form
            action={action}
            onSubmit={event => {
                if (isPending) {
                    event.preventDefault();
                    return;
                }
                onSubmit();
            }}
            className="space-y-3"
        >
            <div
                aria-hidden="true"
                className="absolute -left-[9999px] size-px overflow-hidden"
            >
                <input
                    type="text"
                    name={honeypotField}
                    tabIndex={-1}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-bwignore
                    defaultValue=""
                />
            </div>
            <MailAlertField
                name="email"
                label={t('emailLabel')}
                type="email"
                inputMode="email"
                autoComplete="email"
                inputRef={inputRef}
                defaultValue={defaultEmail}
                readOnly={emailLocked}
                error={errorStatus === null ? null : errorText(errorStatus)}
            />
            <MailAlertNotice />
            <button
                type="submit"
                aria-disabled={isPending}
                className={cn(BUTTON_PRIMARY, 'h-11 w-full px-4 text-sm')}
            >
                {t('sendCode')}
            </button>
        </form>
    );
}
