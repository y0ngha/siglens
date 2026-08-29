'use client';

import { useTranslations } from 'next-intl';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';
import { useId, useState } from 'react';

interface ResetPasswordFormProps {
    email: string;
    token: string;
}

/**
 * 에러 **코드**로 문구를 만든다 — use-case가 함께 돌려주는 `message`는
 * 로그·폴백용 한국어 원문이라 화면에 그대로 쓰면 `/en/reset-password`가
 * 영어 폼 위에 한국어 오류를 띄운다. 코드가 표에 없을 때만 원문으로 떨어진다.
 */
function describeCode(
    error: { code?: string; message: string } | null | undefined,
    tAuth: (key: string) => string
): string | null {
    if (!error) return null;
    const key = error.code ? AUTH_ERROR_KEY[error.code] : undefined;
    return key ? tAuth(key) : error.message;
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
    const tAuth = useTranslations('entities.auth');
    const formError =
        state.error && FORM_ERROR_CODES.has(state.error.code ?? '')
            ? describeCode(state.error, tAuth)
            : null;
    const fieldError =
        state.error?.field === 'password'
            ? describeCode(state.error, tAuth)
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
            {formError ? <AuthErrorAlert message={formError} /> : null}
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
