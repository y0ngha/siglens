'use client';

import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';
import type { ResetPasswordFormState } from '@/shared/lib/types';
import { useCallback, useId, useState } from 'react';

interface ResetPasswordFormProps {
    email: string;
    token: string;
}

const INVALID_TOKEN_MESSAGE =
    '재설정 링크가 유효하지 않거나 이미 사용되었습니다. 다시 요청해 주세요.';
const EXPIRED_TOKEN_MESSAGE =
    '재설정 링크가 만료되었습니다. 다시 요청해 주세요.';

function describeFormError(state: ResetPasswordFormState): string | null {
    if (state.error?.code === 'invalid_token') return INVALID_TOKEN_MESSAGE;
    if (state.error?.code === 'expired_token') return EXPIRED_TOKEN_MESSAGE;
    if (state.error?.code === 'same_password') return state.error.message;
    if (state.error?.code === 'redis_unavailable') return state.error.message;
    return null;
}

function describePasswordFieldError(
    state: ResetPasswordFormState
): string | null {
    if (state.error?.field === 'password') return state.error.message;
    return null;
}

export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const hintId = useId();
    const [state, formAction] = useResetPasswordForm();
    const formError = describeFormError(state);
    const fieldError = describePasswordFieldError(state);

    const handleAction = useCallback(
        (formData: FormData) => {
            if (password !== confirmPassword) {
                setConfirmError('비밀번호가 일치하지 않습니다.');
                return;
            }
            setConfirmError(null);
            setPassword('');
            setConfirmPassword('');
            formAction(formData);
        },
        [formAction, password, confirmPassword]
    );

    return (
        <form action={handleAction} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            {formError ? <AuthErrorAlert message={formError} /> : null}
            <PasswordField
                id="reset-password"
                name="newPassword"
                label="새 비밀번호"
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
                label="새 비밀번호 확인"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={value => {
                    setConfirmPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                error={confirmError ?? undefined}
            />
            <SubmitButton label="비밀번호 변경" pendingLabel="변경 중…" />
        </form>
    );
}
