'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { EMAIL_VERIFICATION_CODE_LENGTH } from '@/entities/auth/lib/authUseCaseConstants';
import type { MailAlertRequestCodeState } from '@/entities/mail-alert/model';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import {
    useMailAlertErrorText,
    type MailAlertErrorStatus,
} from '../hooks/useMailAlertErrorText';
import { MailAlertField } from './MailAlertField';

interface MailAlertCodeStepProps {
    /**
     * 코드 확인 요청에 숨은 입력으로 함께 가는 값 — 이 화면이 무엇을 확정하는지(알림 항목의 `kind`와 그 필드,
     * 또는 가격대 알림 제안의 `token`)를 서버 액션에 알린다.
     */
    readonly hiddenFields: readonly (readonly [name: string, value: string])[];
    /** 코드를 보낸 주소(정규화된 값) — 코드 확인 요청에 숨은 입력으로 함께 간다. */
    readonly email: string;
    readonly confirmAction: (formData: FormData) => void;
    readonly isConfirming: boolean;
    /**
     * 코드 확인의 마지막 결과. 같은 오류가 거듭 와도 매번 새 객체라 오류 칸으로 포커스를 다시 옮기는 신호가 된다.
     */
    readonly confirmState: { readonly status: string };
    /** `confirmState`에서 풀어 낸 오류. 아직 오류가 없으면 `null`. */
    readonly confirmError: MailAlertErrorStatus | null;
    /** "코드 다시 받기" 제출이 쓰는 폼 액션(코드 받기 서버 액션을 감싼 것). */
    readonly resendAction: (formData: FormData) => void;
    /** 다시 받기의 결과 — 실패는 이 단계 안에서 알린다. */
    readonly resendState: MailAlertRequestCodeState;
    readonly isResending: boolean;
    readonly resendRemainingSeconds: number;
    readonly onChangeEmail: () => void;
}

/**
 * 2단계: 받은 6자리 코드. 마운트되면 코드 칸에 포커스를 둔다(스크린리더가 안내문과 칸을 이어 읽는다).
 * "다시 받기"는 같은 폼의 두 번째 제출 버튼(`formAction`)이라 주소와 항목을 다시 싣지 않아도 된다. 쿨다운
 * 중에는 `aria-disabled`로 막아 포커스를 잃지 않는다(AX-3).
 */
export function MailAlertCodeStep({
    hiddenFields,
    email,
    confirmAction,
    isConfirming,
    confirmState,
    confirmError,
    resendAction,
    resendState,
    isResending,
    resendRemainingSeconds,
    onChangeEmail,
}: MailAlertCodeStepProps) {
    const t = useTranslations('features.mail-alert');
    const errorText = useMailAlertErrorText();
    const codeRef = useRef<HTMLInputElement>(null);
    const errorStatus = confirmError;
    const resendBlocked = resendRemainingSeconds > 0 || isResending;
    const resendErrorStatus =
        resendState.status === 'invalid_email' ||
        resendState.status === 'rate_limited' ||
        resendState.status === 'unavailable'
            ? resendState.status
            : null;

    useEffect(() => {
        codeRef.current?.focus();
    }, []);
    useEffect(() => {
        if (errorStatus !== null) codeRef.current?.focus();
    }, [confirmState, errorStatus]);

    return (
        <form
            action={confirmAction}
            onSubmit={event => {
                if (isConfirming) event.preventDefault();
            }}
            className="space-y-3"
        >
            <input type="hidden" name="email" value={email} />
            {hiddenFields.map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
            ))}
            <p className="text-sm text-secondary-300">
                {t('codePrompt', {
                    email,
                    length: EMAIL_VERIFICATION_CODE_LENGTH,
                })}
            </p>
            <MailAlertField
                name="code"
                label={t('codeLabel')}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                inputRef={codeRef}
                maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
                pattern="[0-9]*"
                error={errorStatus === null ? null : errorText(errorStatus)}
            />
            <button
                type="submit"
                aria-disabled={isConfirming}
                className={cn(BUTTON_PRIMARY, 'h-11 w-full px-4 text-sm')}
            >
                {t('confirm')}
            </button>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                    type="submit"
                    formAction={resendAction}
                    formNoValidate
                    aria-disabled={resendBlocked}
                    onClick={event => {
                        if (resendBlocked) event.preventDefault();
                    }}
                    className={cn(BUTTON_GHOST, 'min-h-11 px-2 text-sm')}
                >
                    {resendRemainingSeconds > 0
                        ? t('resendWait', { seconds: resendRemainingSeconds })
                        : t('resend')}
                </button>
                <button
                    type="button"
                    onClick={onChangeEmail}
                    className={cn(BUTTON_GHOST, 'min-h-11 px-2 text-sm')}
                >
                    {t('changeEmail')}
                </button>
            </div>
            <p
                aria-live="polite"
                className="min-h-5 text-sm text-ui-danger-text"
            >
                {resendErrorStatus === null
                    ? null
                    : errorText(resendErrorStatus)}
            </p>
        </form>
    );
}
