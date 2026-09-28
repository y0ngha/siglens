'use client';

import { useTranslations } from 'next-intl';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';
import { useId, useState } from 'react';

interface ResetPasswordFormProps {
    email: string;
    token: string;
}

const FORM_ERROR_CODES = new Set([
    'invalid_token',
    'expired_token',
    'same_password',
    'redis_unavailable',
]);

export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
    const t = useTranslations('features.auth-password-reset');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const hintId = useId();
    const [state, formAction] = useResetPasswordForm();
    const describeAuthError = useDescribeAuthError();
    const formError =
        state.error && FORM_ERROR_CODES.has(state.error.code ?? '')
            ? describeAuthError(state.error)
            : null;
    const fieldError =
        state.error?.field === 'password'
            ? describeAuthError(state.error)
            : null;

    const handleAction = (formData: FormData) => {
        if (password !== confirmPassword) {
            setConfirmError(t('ResetPasswordForm.c3b85c'));
            return;
        }
        setConfirmError(null);
        // 여기서 입력을 비우지 않는다. 성공하면 액션이 리디렉트하므로 비울
        // 필요가 없고, 실패하면(약한 비밀번호·같은 비밀번호·만료 토큰) 빈 칸
        // 아래에 오류만 남아 전부 다시 타이핑해야 했다. 강도 체크리스트도
        // 함께 초기화돼 무엇이 모자랐는지조차 사라졌다.
        formAction(formData);
    };

    return (
        <form action={handleAction} className="space-y-4" noValidate>
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
                onChange={value => {
                    setPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                error={fieldError ?? undefined}
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
                onChange={value => {
                    setConfirmPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                error={confirmError ?? undefined}
            />
            <SubmitButton
                label={t('ResetPasswordForm.4c7b96')}
                pendingLabel={t('ResetPasswordForm.5926a3')}
            />
        </form>
    );
}
