'use client';

import type { LoginFormState } from '@/domain/auth/formTypes';
import { useLoginForm } from '@/components/hooks/useLoginForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthFieldGroup } from './AuthFieldGroup';
import { PasswordField } from './PasswordField';
import { SubmitButton } from './SubmitButton';

interface LoginFormProps {
    next?: string;
    initialError?: string;
}

const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';

function describeError(
    state: LoginFormState,
    initialError?: string
): string | null {
    if (state.error?.code === 'invalid_credentials')
        return INVALID_CREDENTIALS_MESSAGE;
    if (state.error?.message) return state.error.message;
    return initialError ?? null;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
    const [state, formAction] = useLoginForm();
    const errorMessage = describeError(state, initialError);
    return (
        <form action={formAction} className="space-y-4" noValidate>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {errorMessage ? <AuthErrorAlert message={errorMessage} /> : null}
            <AuthFieldGroup
                id="login-email"
                name="email"
                label="이메일"
                type="email"
                autoComplete="email"
                required
            />
            <PasswordField
                id="login-password"
                name="password"
                label="비밀번호"
                autoComplete="current-password"
                required
            />
            <SubmitButton label="로그인" pendingLabel="로그인 중…" />
        </form>
    );
}
