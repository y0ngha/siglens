'use client';

import { useId, useState } from 'react';
import { useSignupForm } from '@/components/hooks/useSignupForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthFieldGroup } from './AuthFieldGroup';
import { PasswordField } from './PasswordField';
import { PasswordStrengthHint } from './PasswordStrengthHint';
import { SubmitButton } from './SubmitButton';

interface SignupFormProps {
    next?: string;
}

export function SignupForm({ next }: SignupFormProps) {
    const [password, setPassword] = useState('');
    const hintId = useId();
    const [state, formAction] = useSignupForm();
    const error = state.error;
    const emailError = error?.field === 'email' ? error.message : undefined;
    const passwordError =
        error?.field === 'password' ? error.message : undefined;
    const formError =
        error && error.code === 'auto_login_failed' ? error.message : null;
    return (
        <form action={formAction} className="space-y-4" noValidate>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {formError ? <AuthErrorAlert message={formError} /> : null}
            <AuthFieldGroup
                id="signup-email"
                name="email"
                label="이메일"
                type="email"
                autoComplete="email"
                required
                error={emailError}
            />
            <PasswordField
                id="signup-password"
                name="password"
                label="비밀번호"
                autoComplete="new-password"
                required
                error={passwordError}
                describedById={hintId}
                onChange={setPassword}
                hint={
                    <PasswordStrengthHint
                        password={password}
                        descriptionId={hintId}
                    />
                }
            />
            <SubmitButton label="회원가입" pendingLabel="가입 중…" />
        </form>
    );
}
