'use client';

import { useId, useState } from 'react';
import type { ResetPasswordFormState } from '@/domain/auth/formTypes';
import { useResetPasswordForm } from '@/components/hooks/useResetPasswordForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { PasswordField } from './PasswordField';
import { PasswordStrengthHint } from './PasswordStrengthHint';
import { SubmitButton } from './SubmitButton';

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
    const [state, formAction] = useResetPasswordForm();
    const formError = describeFormError(state);
    const fieldError = describePasswordFieldError(state);
    const hintId = useId();
    return (
        <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            {formError ? <AuthErrorAlert message={formError} /> : null}
            <PasswordField
                id="reset-password"
                name="newPassword"
                label="새 비밀번호"
                autoComplete="new-password"
                required
                onChange={setPassword}
                error={fieldError ?? undefined}
                describedById={hintId}
                hint={
                    <PasswordStrengthHint
                        password={password}
                        descriptionId={hintId}
                    />
                }
            />
            <SubmitButton label="비밀번호 변경" pendingLabel="변경 중…" />
        </form>
    );
}
