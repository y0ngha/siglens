'use client';

import { useTranslations } from 'next-intl';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import type { EmailStepModel } from '../hooks/useSignupFlow';
import { SIGNUP_FIELD_ID } from '../lib/signupPhase';

interface EmailStepFormProps {
    step: EmailStepModel;
}

/**
 * 1단계: 인증 코드를 받을 이메일. 입력은 비제어(`defaultValue`)라 React가
 * 액션 뒤 폼을 리셋해도 `draftEmail`로 값이 돌아온다.
 */
export function EmailStepForm({ step }: EmailStepFormProps) {
    const t = useTranslations('features.auth-signup');
    return (
        <form action={step.action} className="space-y-4" noValidate>
            {step.bannerError ? (
                <ErrorAlert message={step.bannerError} />
            ) : null}
            <TextField
                id={SIGNUP_FIELD_ID.email}
                name="email"
                label={t('SignupForm.3c3776')}
                type="email"
                autoComplete="email"
                required
                defaultValue={step.draftEmail}
                error={step.fieldError}
                onChange={event => step.onDraftEmailChange(event.target.value)}
            />
            <SubmitButton
                label={t('SignupForm.f4a9ff')}
                pendingLabel={t('SignupForm.8321f5')}
            />
        </form>
    );
}
