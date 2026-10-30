'use client';

import { useTranslations } from 'next-intl';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';
import { usePasswordConfirmation } from '../hooks/usePasswordConfirmation';
import { resetPasswordErrorSlot } from '../lib/resetPasswordErrorSlot';
import { useId } from 'react';

interface ResetPasswordFormProps {
    /** 재설정 링크의 이메일. 숨은 필드로 액션에 그대로 넘긴다. */
    email: string;
    /** 재설정 링크의 토큰. 검증은 서버 액션이 한다. */
    token: string;
}

/**
 * 메일 링크로 들어온 사용자의 새 비밀번호 입력 폼. 성공하면 액션이 로그인
 * 화면으로 리디렉트하므로 성공 상태를 그리지 않는다.
 */
export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
    const t = useTranslations('features.auth-password-reset');
    const hintId = useId();
    const [state, formAction] = useResetPasswordForm();
    const describeAuthError = useDescribeAuthError();
    const {
        password,
        confirmPassword,
        isMismatch,
        changePassword,
        changeConfirmPassword,
        submit,
    } = usePasswordConfirmation(formAction);
    const errorSlot = state.error ? resetPasswordErrorSlot(state.error) : null;
    const errorMessage = describeAuthError(state.error);
    const formError = errorSlot === 'form' ? errorMessage : undefined;
    const passwordError = errorSlot === 'password' ? errorMessage : undefined;

    return (
        <form action={submit} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            {formError ? <ErrorAlert message={formError} /> : null}
            <PasswordField
                id="reset-password"
                name="newPassword"
                label={t('ResetPasswordForm.783ba8')}
                autoComplete="new-password"
                required
                value={password}
                onChange={changePassword}
                error={passwordError}
                describedById={hintId}
                hint={
                    <PasswordStrengthHint
                        password={password}
                        descriptionId={hintId}
                    />
                }
            />
            <PasswordField
                id="reset-password-confirm"
                name="confirmPassword"
                label={t('ResetPasswordForm.2fe1f8')}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={changeConfirmPassword}
                error={isMismatch ? t('ResetPasswordForm.c3b85c') : undefined}
            />
            <SubmitButton
                label={t('ResetPasswordForm.4c7b96')}
                pendingLabel={t('ResetPasswordForm.5926a3')}
            />
        </form>
    );
}
