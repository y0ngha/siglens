'use client';

import { useTranslations } from 'next-intl';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
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

/**
 * 에러 **코드**로 번역한다 — use-case가 함께 돌려주는 `message`는 한국어
 * 원문이라 화면에 그대로 나가면 안 된다(예전에는 그게 그대로 나갔다).
 * 코드가 표에 없을 때만 `message`로 떨어진다.
 */
function useDescribeError(
    state: LoginFormState,
    initialError?: string
): string | null {
    const tAuth = useTranslations('entities.auth');
    const code = state.error?.code;
    if (code && AUTH_ERROR_KEY[code]) return tAuth(AUTH_ERROR_KEY[code]);
    if (state.error?.message) return state.error.message;
    return initialError ?? null;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
    const t = useTranslations('features.auth-login');
    const [state, formAction] = useLoginForm();
    const errorMessage = useDescribeError(state, initialError);
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
