'use client';

import { useTranslations } from 'next-intl';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';
import { useEffect, useRef } from 'react';

/**
 * 성공 시 폼이 통째로 사라지므로 **포커스와 알림을 명시적으로 다뤄야 한다.**
 *
 * 예전에는 `state.submitted`에서 곧장 성공 패널만 반환했다. 그러면 두 가지가
 * 깨진다:
 *
 *  1. 포커스를 쥐고 있던 제출 버튼이 언마운트돼 포커스가 `<body>`로 떨어진다.
 *     키보드 사용자는 방금 무슨 일이 있었는지도, 자기가 어디 있는지도 잃는다.
 *  2. `aria-live` 영역이 **내용과 같은 순간에** DOM에 삽입된다. 라이브 영역은
 *     미리 존재해야 변화가 안정적으로 읽힌다 — 삽입과 동시에 채우면 보조기술에
 *     따라 아무것도 읽지 않는다.
 *
 * 그래서 라이브 영역은 항상 렌더해 두고 안쪽 내용만 바뀌게 하며, 성공 패널에
 * `tabIndex={-1}`을 주고 마운트 시 포커스를 옮긴다.
 */
export function ForgotPasswordForm() {
    const t = useTranslations('features.auth-password-reset');
    const tAuth = useTranslations('entities.auth');
    const [state, formAction] = useForgotPasswordForm();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (state.submitted) panelRef.current?.focus();
    }, [state.submitted]);

    return (
        <>
            {/* 라이브 영역은 제출 전에도 비어 있는 채로 존재한다. */}
            <div role="status" aria-live="polite">
                {state.submitted ? (
                    <div
                        ref={panelRef}
                        tabIndex={-1}
                        className="space-y-2 rounded-lg border border-secondary-700 bg-secondary-900/60 p-4 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        <p className="font-semibold text-secondary-100">
                            {t('ForgotPasswordForm.fe04f2')}
                        </p>
                        <p className="text-secondary-300">
                            {t('ForgotPasswordForm.4fd65c')}
                        </p>
                        <p className="text-secondary-300">
                            {t('ForgotPasswordForm.3e3640')}
                        </p>
                    </div>
                ) : null}
            </div>
            {state.submitted ? null : (
                <form action={formAction} className="space-y-4" noValidate>
                    <AuthFieldGroup
                        id="forgot-email"
                        name="email"
                        label={t('ForgotPasswordForm.3c3776')}
                        type="email"
                        autoComplete="email"
                        required
                        /*
                         * 형식 오류만 표시한다. 계정 존재 여부는 여전히 숨긴다 —
                         * 열거 방어는 "가입돼 있는가"를 감추는 것이지, 빈 값에도
                         * "메일을 보냈다"고 말하라는 뜻이 아니다.
                         */
                        error={
                            state.errorCode
                                ? tAuth(
                                      AUTH_ERROR_KEY[state.errorCode] ??
                                          'error.emailInvalid'
                                  )
                                : undefined
                        }
                    />
                    <SubmitButton
                        label={t('ForgotPasswordForm.f4d6d3')}
                        pendingLabel={t('ForgotPasswordForm.8321f5')}
                    />
                </form>
            )}
        </>
    );
}
