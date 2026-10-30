'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import { ConsentCheckboxGroup } from '@/shared/ui/auth/ConsentCheckboxGroup';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import type { DetailsStepModel } from '../hooks/useSignupFlow';
import { SIGNUP_FIELD_ID } from '../lib/signupPhase';
import { EmailEditButton } from './EmailEditButton';

interface DetailsStepFormProps {
    step: DetailsStepModel;
    /** 인증을 마친 이메일. hidden 입력으로 가입 액션에 넘긴다. */
    email: string;
    /** 가입 후 돌아갈 경로. 액션이 같은-오리진 경로로 다시 걸러 낸다. */
    next?: string;
    onEditEmail: () => void;
}

/**
 * 3단계: 표시 이름·비밀번호·필수 동의. 입력값은 이 단계에서만 쓰므로 여기서
 * 들고 있다 — 단계가 바뀌거나 흐름이 다시 시작되면 함께 사라진다.
 */
export function DetailsStepForm({
    step,
    email,
    next,
    onEditEmail,
}: DetailsStepFormProps) {
    const t = useTranslations('features.auth-signup');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [tosChecked, setTosChecked] = useState(false);
    const hintId = useId();

    return (
        <form action={step.action} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <input
                type="hidden"
                name="agreed_privacy"
                value={privacyChecked ? 'true' : 'false'}
            />
            <input
                type="hidden"
                name="agreed_tos"
                value={tosChecked ? 'true' : 'false'}
            />
            {step.bannerError ? (
                <ErrorAlert message={step.bannerError} />
            ) : null}
            <p className="text-sm text-secondary-300">
                <span className="text-ui-success-text" aria-hidden="true">
                    ✓
                </span>{' '}
                {t('SignupForm.0d75cf')}{' '}
                <span className="font-mono break-all text-secondary-100">
                    {email}
                </span>{' '}
                <EmailEditButton onClick={onEditEmail} />
            </p>
            <TextField
                id={SIGNUP_FIELD_ID.name}
                name="name"
                label={t('SignupForm.e4d212')}
                type="text"
                autoComplete="name"
                placeholder={t('SignupForm.4e96eb')}
                value={name}
                onChange={event => setName(event.target.value)}
            />
            <PasswordField
                id={SIGNUP_FIELD_ID.password}
                name="password"
                label={t('SignupForm.819738')}
                autoComplete="new-password"
                required
                value={password}
                error={step.passwordError}
                describedById={hintId}
                onChange={setPassword}
                hint={
                    <PasswordStrengthHint
                        password={password}
                        descriptionId={hintId}
                    />
                }
            />
            <ConsentCheckboxGroup
                privacyChecked={privacyChecked}
                tosChecked={tosChecked}
                onPrivacyChange={setPrivacyChecked}
                onTosChange={setTosChecked}
                error={step.consentError}
            />
            <SubmitButton
                label={t('SignupForm.ecb4cc')}
                pendingLabel={t('SignupForm.d01150')}
            />
        </form>
    );
}
