'use client';

import { useTranslations } from 'next-intl';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { TextField } from '@/shared/ui/TextField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';

/** 성공 시 폼이 통째로 사라진다 — 포커스·알림 처리는 `SuccessNotice` 참고. */
export function ForgotPasswordForm() {
    const t = useTranslations('features.auth-password-reset');
    const tAuth = useTranslations('entities.auth');
    const [state, formAction] = useForgotPasswordForm();

    return (
        <>
            <SuccessNotice
                show={state.submitted}
                title={t('ForgotPasswordForm.fe04f2')}
                messages={[
                    t('ForgotPasswordForm.4fd65c'),
                    t('ForgotPasswordForm.3e3640'),
                ]}
            />
            {state.submitted ? null : (
                <form action={formAction} className="space-y-4" noValidate>
                    <TextField
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
