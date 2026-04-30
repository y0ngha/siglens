'use client';

import { useId, useState } from 'react';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/components/hooks/useEmailVerificationForms';
import { useSignupForm } from '@/components/hooks/useSignupForm';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthFieldGroup } from './AuthFieldGroup';
import { PasswordField } from './PasswordField';
import { PasswordStrengthHint } from './PasswordStrengthHint';
import { SubmitButton } from './SubmitButton';

interface SignupFormProps {
    next?: string;
}

type Phase = 'email' | 'code' | 'details';

const STEP_LABEL: Record<Phase, string> = {
    email: '1단계: 이메일 인증 요청',
    code: '2단계: 인증 코드 확인',
    details: '3단계: 비밀번호 및 표시 이름 설정',
};

function StepIndicator({ phase }: { phase: Phase }) {
    return (
        <p
            aria-live="polite"
            className="text-secondary-400 mb-4 text-xs font-medium tracking-wider uppercase"
        >
            {STEP_LABEL[phase]}
        </p>
    );
}

export function SignupForm({ next }: SignupFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const hintId = useId();

    const [emailState, emailFormAction] = useRequestEmailVerification();
    const [codeState, codeFormAction] = useVerifyEmail();
    const [signupState, signupFormAction] = useSignupForm();

    // Phase는 각 useActionState 결과에서 직접 derive — useEffect+setPhase로 동기화하지 않는다
    // (react-hooks/set-state-in-effect 회피).
    const phase: Phase = codeState.verified
        ? 'details'
        : emailState.submitted
          ? 'code'
          : 'email';

    const signupError = signupState.error;
    const signupEmailError =
        signupError?.field === 'email' ? signupError.message : undefined;
    const signupPasswordError =
        signupError?.field === 'password' ? signupError.message : undefined;
    const signupFormError =
        signupError && !signupError.field ? signupError.message : null;

    return (
        <div className="space-y-4">
            <StepIndicator phase={phase} />
            {phase === 'email' ? (
                <form action={emailFormAction} className="space-y-4" noValidate>
                    {emailState.error ? (
                        <AuthErrorAlert message={emailState.error.message} />
                    ) : null}
                    <AuthFieldGroup
                        id="signup-email"
                        name="email"
                        label="이메일"
                        type="email"
                        autoComplete="email"
                        required
                        defaultValue={email}
                        onChange={event => setEmail(event.target.value)}
                    />
                    <SubmitButton
                        label="인증 코드 받기"
                        pendingLabel="발송 중…"
                    />
                </form>
            ) : null}

            {phase === 'code' ? (
                <form action={codeFormAction} className="space-y-4" noValidate>
                    <input type="hidden" name="email" value={email} />
                    {codeState.error ? (
                        <AuthErrorAlert message={codeState.error.message} />
                    ) : null}
                    <p className="text-secondary-300 text-sm">
                        <span className="text-secondary-100 font-mono break-all">
                            {email}
                        </span>
                        로 인증 코드를 보냈어요. 메일을 확인해 주세요.
                    </p>
                    <AuthFieldGroup
                        id="signup-code"
                        name="code"
                        label="인증 코드"
                        type="text"
                        autoComplete="one-time-code"
                        required
                        placeholder="6자리 코드"
                    />
                    <SubmitButton label="코드 확인" pendingLabel="확인 중…" />
                </form>
            ) : null}

            {phase === 'details' ? (
                <form
                    action={signupFormAction}
                    className="space-y-4"
                    noValidate
                >
                    <input type="hidden" name="email" value={email} />
                    {next ? (
                        <input type="hidden" name="next" value={next} />
                    ) : null}
                    {signupFormError ? (
                        <AuthErrorAlert message={signupFormError} />
                    ) : null}
                    {signupEmailError ? (
                        <AuthErrorAlert message={signupEmailError} />
                    ) : null}
                    <p className="text-secondary-300 text-sm">
                        <span className="text-ui-success">✓</span> 인증 완료:{' '}
                        <span className="text-secondary-100 font-mono break-all">
                            {email}
                        </span>
                    </p>
                    <AuthFieldGroup
                        id="signup-name"
                        name="name"
                        label="표시 이름 (선택)"
                        type="text"
                        autoComplete="name"
                        placeholder="다른 사용자에게 보이는 이름"
                    />
                    <PasswordField
                        id="signup-password"
                        name="password"
                        label="비밀번호"
                        autoComplete="new-password"
                        required
                        error={signupPasswordError}
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
            ) : null}
        </div>
    );
}
