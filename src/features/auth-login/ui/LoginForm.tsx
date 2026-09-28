'use client';

import { useTranslations } from 'next-intl';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import { useLoginForm } from '../hooks/useLoginForm';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';

interface LoginFormProps {
    next?: string;
    initialError?: string;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
    const t = useTranslations('features.auth-login');
    const [state, formAction] = useLoginForm();
    const describeAuthError = useDescribeAuthError();
    // 액션 에러가 없거나 문구가 비면 OAuth 콜백 `?error=`에서 온 초기 오류로 떨어진다.
    const errorMessage = describeAuthError(state.error) || initialError || null;
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
