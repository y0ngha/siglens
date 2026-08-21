'use client';

import { useTranslations } from 'next-intl';
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/features/auth-email-verification';
import { useSignupForm } from '../hooks/useSignupForm';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';
import { ConsentCheckboxGroup } from '@/shared/ui/auth/ConsentCheckboxGroup';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';

interface SignupFormProps {
    next?: string;
}

type Phase = 'email' | 'code' | 'details';

/** 단계 제목은 카탈로그 키로 들고 있다 — 문자열이면 `/en/signup`에서 여기만 한국어다. */
const STEP_LABEL_KEY: Record<Phase, string> = {
    email: 'SignupForm.stepEmail',
    code: 'SignupForm.stepCode',
    details: 'SignupForm.stepDetails',
};

function derivePhase(submitted: boolean, verified: boolean): Phase {
    if (verified) return 'details';
    if (submitted) return 'code';
    return 'email';
}

interface StepIndicatorProps {
    phase: Phase;
}

function StepIndicator({ phase }: StepIndicatorProps) {
    const t = useTranslations('features.auth-signup');
    return (
        <p
            aria-live="polite"
            className="mb-4 text-xs font-medium tracking-wider text-secondary-400 uppercase"
        >
            {t(STEP_LABEL_KEY[phase])}
        </p>
    );
}

interface EmailEditButtonProps {
    onClick: () => void;
}

function EmailEditButton({ onClick }: EmailEditButtonProps) {
    const t = useTranslations('features.auth-signup');
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-sm font-medium text-primary-400 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
        >
            {t('SignupForm.f38cb1')}
        </button>
    );
}

export function SignupForm({ next }: SignupFormProps) {
    const [resetKey, setResetKey] = useState(0);

    const handleRestart = useCallback((): void => {
        setResetKey(current => current + 1);
    }, []);

    // 브라우저 bfcache로 페이지가 복원될 경우 1단계로 초기화
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent): void => {
            if (event.persisted) {
                handleRestart();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, [handleRestart]);

    // Next.js router cache로 컴포넌트가 메모리에 유지된 채 뒤로가기가 발생하면
    // popstate 이벤트로 감지해 1단계로 초기화
    useEffect(() => {
        window.addEventListener('popstate', handleRestart);
        return () => window.removeEventListener('popstate', handleRestart);
    }, [handleRestart]);

    return (
        <SignupFormFlow key={resetKey} next={next} onRestart={handleRestart} />
    );
}

interface SignupFormFlowProps extends SignupFormProps {
    onRestart: () => void;
}

function SignupFormFlow({ next, onRestart }: SignupFormFlowProps) {
    const t = useTranslations('features.auth-signup');
    const tAuth = useTranslations('entities.auth');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [tosChecked, setTosChecked] = useState(false);
    const hintId = useId();

    const [emailState, emailFormAction] = useRequestEmailVerification();
    const [codeState, codeFormAction] = useVerifyEmail();
    const [signupState, signupFormAction] = useSignupForm();

    // useActionState 결과에서 직접 derive — set-state-in-effect 회피.
    const phase = derivePhase(emailState.submitted, codeState.verified);

    // Next.js router cache가 useActionState를 이전 세션 값으로 hydrate한 채
    // 컴포넌트를 리마운트할 수 있다. 마운트 시점에 이미 non-initial 상태라면
    // 뒤로가기로 복원된 것이므로 paint 전에 1단계로 리셋한다.
    const restoredFromCacheRef = useRef(
        emailState.submitted || codeState.verified
    );
    useLayoutEffect(() => {
        if (restoredFromCacheRef.current) {
            onRestart();
        }
    }, [onRestart]);

    const signupError = signupState.error;
    /**
     * 에러 **코드**로 문구를 만든다.
     *
     * use-case가 함께 돌려주는 `message`는 로그·폴백용 한국어 원문이라 화면에
     * 그대로 쓰면 `/en/signup`이 영어 폼 위에 한국어 오류를 띄운다 — 실제로
     * 그렇게 나가고 있었다. 코드가 표에 없을 때만 원문으로 떨어진다.
     */
    const describe = (
        error: { code?: string; message: string } | null | undefined
    ): string | undefined => {
        if (!error) return undefined;
        const key = error.code ? AUTH_ERROR_KEY[error.code] : undefined;
        return key ? tAuth(key) : error.message;
    };
    const signupEmailError =
        signupError?.field === 'email' ? describe(signupError) : undefined;
    const signupPasswordError =
        signupError?.field === 'password' ? describe(signupError) : undefined;
    const consentErrorMessage =
        signupError?.code === 'consent_required'
            ? describe(signupError)
            : undefined;
    const signupFormError =
        signupError &&
        !signupError.field &&
        signupError.code !== 'consent_required'
            ? describe(signupError)
            : null;

    return (
        <div className="space-y-4">
            <StepIndicator phase={phase} />
            {phase === 'email' && (
                <form action={emailFormAction} className="space-y-4" noValidate>
                    {emailState.error ? (
                        <AuthErrorAlert
                            message={describe(emailState.error) ?? ''}
                        />
                    ) : null}
                    <AuthFieldGroup
                        id="signup-email"
                        name="email"
                        label={t('SignupForm.3c3776')}
                        type="email"
                        autoComplete="email"
                        required
                        defaultValue={email}
                        onChange={event => setEmail(event.target.value.trim())}
                    />
                    <SubmitButton
                        label={t('SignupForm.f4a9ff')}
                        pendingLabel={t('SignupForm.8321f5')}
                    />
                </form>
            )}
            {phase === 'code' && (
                <form action={codeFormAction} className="space-y-4" noValidate>
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
                        <EmailEditButton onClick={onRestart} />
                    </p>
                    {codeState.error?.code === 'redis_unavailable' ||
                    codeState.error?.code === 'email_already_exists' ? (
                        <AuthErrorAlert
                            message={describe(codeState.error) ?? ''}
                        />
                    ) : null}
                    <AuthFieldGroup
                        id="signup-code"
                        name="code"
                        label={t('SignupForm.d89be9')}
                        type="text"
                        autoComplete="one-time-code"
                        required
                        placeholder={t('SignupForm.403732')}
                        error={
                            codeState.error?.code !== 'redis_unavailable' &&
                            codeState.error?.code !== 'email_already_exists'
                                ? describe(codeState.error)
                                : undefined
                        }
                    />
                    <SubmitButton
                        label={t('SignupForm.7b5f5a')}
                        pendingLabel={t('SignupForm.33c1f7')}
                    />
                </form>
            )}
            {phase === 'details' && (
                <form
                    action={signupFormAction}
                    className="space-y-4"
                    noValidate
                >
                    <input type="hidden" name="email" value={email} />
                    {next ? (
                        <input type="hidden" name="next" value={next} />
                    ) : null}
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
                    {signupFormError ? (
                        <AuthErrorAlert message={signupFormError} />
                    ) : null}
                    {signupEmailError ? (
                        <AuthErrorAlert message={signupEmailError} />
                    ) : null}
                    <p className="text-sm text-secondary-300">
                        <span className="text-ui-success" aria-hidden="true">
                            ✓
                        </span>{' '}
                        {t('SignupForm.0d75cf')}{' '}
                        <span className="font-mono break-all text-secondary-100">
                            {email}
                        </span>{' '}
                        <EmailEditButton onClick={onRestart} />
                    </p>
                    <AuthFieldGroup
                        id="signup-name"
                        name="name"
                        label={t('SignupForm.e4d212')}
                        type="text"
                        autoComplete="name"
                        placeholder={t('SignupForm.4e96eb')}
                        value={name}
                        onChange={event => setName(event.target.value)}
                    />
                    <PasswordField
                        id="signup-password"
                        name="password"
                        label={t('SignupForm.819738')}
                        autoComplete="new-password"
                        required
                        value={password}
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
                    <ConsentCheckboxGroup
                        privacyChecked={privacyChecked}
                        tosChecked={tosChecked}
                        onPrivacyChange={setPrivacyChecked}
                        onTosChange={setTosChecked}
                        error={consentErrorMessage}
                    />
                    <SubmitButton
                        label={t('SignupForm.ecb4cc')}
                        pendingLabel={t('SignupForm.d01150')}
                    />
                </form>
            )}
        </div>
    );
}
