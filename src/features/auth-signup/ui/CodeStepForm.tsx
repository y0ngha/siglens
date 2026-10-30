'use client';

import { useTranslations } from 'next-intl';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import type { CodeStepModel } from '../hooks/useSignupFlow';
import { SIGNUP_FIELD_ID } from '../lib/signupPhase';
import { EmailEditButton } from './EmailEditButton';

interface CodeStepFormProps {
    step: CodeStepModel;
    /** 코드를 보낸 이메일. 안내 문구와 hidden 입력에 그대로 쓴다. */
    email: string;
    onEditEmail: () => void;
}

/** 2단계: 메일로 받은 인증 코드 확인. */
export function CodeStepForm({ step, email, onEditEmail }: CodeStepFormProps) {
    const t = useTranslations('features.auth-signup');
    return (
        <form action={step.action} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            <p className="text-sm text-secondary-300">
                {t.rich('SignupForm.d50482', {
                    v0: email,
                    email: chunks => (
                        <span className="font-mono break-all text-secondary-100">
                            {chunks}
                        </span>
                    ),
                })}{' '}
                <EmailEditButton onClick={onEditEmail} />
            </p>
            {step.bannerError ? (
                <ErrorAlert message={step.bannerError} />
            ) : null}
            <TextField
                id={SIGNUP_FIELD_ID.code}
                name="code"
                label={t('SignupForm.d89be9')}
                type="text"
                autoComplete="one-time-code"
                required
                placeholder={t('SignupForm.403732')}
                error={step.fieldError}
            />
            <SubmitButton
                label={t('SignupForm.7b5f5a')}
                pendingLabel={t('SignupForm.33c1f7')}
            />
        </form>
    );
}
