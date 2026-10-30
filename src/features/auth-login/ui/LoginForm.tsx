'use client';

/**
 * @file 이메일·비밀번호 로그인 폼. 제출은 `useLoginForm`의 서버 액션으로 간다.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import { useLoginForm } from '../hooks/useLoginForm';
import { useLoginErrorFocus } from '../hooks/useLoginErrorFocus';
import { LOGIN_FIELD } from '../lib/loginFields';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';

interface LoginFormProps {
    /** 로그인 후 돌아갈 경로. 서버 액션이 다시 검사하므로 여기서는 그대로 싣는다. */
    next?: string;
    /** OAuth 콜백 `?error=` 등에서 이미 번역된 초기 오류 문구. */
    initialError?: string;
}

/** 로그인 폼. 실패하면 이메일은 남기고 비워진 비밀번호 칸으로 포커스를 옮긴다. */
export function LoginForm({ next, initialError }: LoginFormProps) {
    const t = useTranslations('features.auth-login');
    const [state, formAction] = useLoginForm();
    const describeAuthError = useDescribeAuthError();
    const formRef = useLoginErrorFocus(state);
    // 제어 입력으로 둔다 — React 19는 액션이 끝나면 비제어 입력을 리셋하므로,
    // 비제어면 비밀번호를 틀릴 때마다 이메일까지 지워져 다시 쳐야 한다.
    const [email, setEmail] = useState('');
    // 액션 에러가 없거나 문구가 비면 OAuth 콜백 `?error=`에서 온 초기 오류로 떨어진다.
    const errorMessage = describeAuthError(state.error) || initialError || null;
    return (
        <form
            ref={formRef}
            action={formAction}
            className="space-y-4"
            noValidate
        >
            {next ? (
                <input type="hidden" name={LOGIN_FIELD.next} value={next} />
            ) : null}
            {errorMessage ? <ErrorAlert message={errorMessage} /> : null}
            <TextField
                id="login-email"
                name={LOGIN_FIELD.email}
                label={t('LoginForm.3c3776')}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
            />
            <PasswordField
                id="login-password"
                name={LOGIN_FIELD.password}
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
