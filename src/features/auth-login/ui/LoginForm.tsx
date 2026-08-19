'use client';

import { useTranslations } from 'next-intl';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';
import { useLoginForm } from '../hooks/useLoginForm';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';

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
    const t = useTranslations('features.auth-login');
    const [state, formAction] = useLoginForm();
    const errorMessage = describeError(state, initialError);
    return (
        <form action={formAction} className="space-y-4" noValidate>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {errorMessage ? <AuthErrorAlert message={errorMessage} /> : null}
            <AuthFieldGroup
                id="login-email"
                name="email"
                label={t('LoginForm.3c3776')}
                type="email"
                autoComplete="email"
                required
            />
            <PasswordField
                id="login-password"
                name="password"
                label={t('LoginForm.819738')}
                autoComplete="current-password"
                required
            />
            <SubmitButton
                label={t('LoginForm.e225a6')}
                pendingLabel={t('LoginForm.21fb76')}
            />
        </form>
    );
}
