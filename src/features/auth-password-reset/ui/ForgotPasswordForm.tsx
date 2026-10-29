'use client';

import { useTranslations } from 'next-intl';
import { TextField } from '@/shared/ui/TextField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';
import { forgotPasswordErrorKey } from '../lib/forgotPasswordErrorKey';
import { useState } from 'react';

/**
 * 비밀번호 재설정 메일 요청 폼. 성공 시 폼이 통째로 사라진다 — 포커스·알림
 * 처리는 `SuccessNotice` 참고.
 */
export function ForgotPasswordForm() {
    const t = useTranslations('features.auth-password-reset');
    const tAuth = useTranslations('entities.auth');
    // 제어 입력이어야 한다. `<form action>`은 액션이 끝나면 비제어 입력을
    // 비우므로, 형식 오류가 나면 고칠 주소가 사라져 처음부터 다시 쳐야 한다.
    const [email, setEmail] = useState('');
    const [state, formAction] = useForgotPasswordForm();
    const errorKey = forgotPasswordErrorKey(state.errorCode);

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
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        error={errorKey ? tAuth(errorKey) : undefined}
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
